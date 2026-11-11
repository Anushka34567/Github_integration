// =============================================================================
// CI/CD pipeline with quality gates and security enforcement
// Repository : https://github.com/Anushka34567/Github_integration  (branch: main)
// Application: Trudesk (Node.js >= 16, Yarn 3.2.1, MongoDB, port 8118)
//
// Every gate stops the pipeline when it fails. Nothing is deployed unless all
// quality and security gates pass AND a named owner approves the deployment.
//
//   Quality gates : lint, unit tests, coverage threshold, production build
//   Security gates: secret scan, no committed .env/config.yml, dependency audit
//                   (SCA), static analysis (SAST), container image scan, and a
//                   production approval by an owner who is not the commit author
//
// Jenkins setup this file expects:
//   - Credentials: 'github-creds-anushka34567'          (GitHub username + token)
//                  'github-integration-mongodb-uri'      (secret text: TD_MONGODB_URI)
//                  'github-integration-jwt-secret'       (secret text: TRUDESK_JWTSECRET)
//   - Agent tools : node >= 16, npm, docker, pm2, curl
//   - Reports from every gate are archived with the build (reports/ folder).
// =============================================================================

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '30'))
    }

    parameters {
        string(name: 'MIN_COVERAGE', defaultValue: '40', description: 'Quality gate: minimum line coverage (%) from unit tests')
        choice(name: 'AUDIT_SEVERITY', choices: ['high', 'critical', 'moderate'], description: 'Security gate: fail on dependency vulnerabilities at or above this level')
    }

    environment {
        APP_HOME    = "${WORKSPACE}"
        APP_NAME    = "trudesk"
        APP_PORT    = "8118"
        REPORTS     = "${WORKSPACE}/reports"

        // Yarn 3.2.1 ships inside the repository (.yarnrc.yml → yarnPath)
        YARN        = "node ${WORKSPACE}/.yarn/releases/yarn-3.2.1.cjs"

        // Pinned scanner images
        GITLEAKS_IMG = "zricethezav/gitleaks:v8.18.4"
        SEMGREP_IMG  = "semgrep/semgrep:1.75.0"
        TRIVY_IMG    = "aquasec/trivy:0.50.1"
        MONGO_IMG    = "mongo:5.0"

        IMAGE_TAG   = "trudesk:${BUILD_NUMBER}"
        TEST_MONGO  = "trudesk-ci-mongo-${BUILD_NUMBER}"

        // Owners from OWNERSHIP_MATRIX.md (primary + backup), allowed to approve production
        DEPLOY_APPROVERS = "rahulnewel,Anushka34567"
    }

    stages {

        stage('Checkout') {
            steps {
                git(
                    credentialsId: 'github-creds-anushka34567',
                    branch: 'main',
                    url: 'https://github.com/Anushka34567/Github_integration.git'
                )
                sh '''
                    set -e
                    mkdir -p "${REPORTS}"
                    echo "Commit : $(git rev-parse HEAD)"
                    echo "Author : $(git log -1 --format='%an <%ae>')"
                '''
            }
        }

        stage('Security Gate: No Committed Secrets') {
            steps {
                sh '''
                    set -e

                    echo "========================================"
                    echo "Checking for secret files tracked in git"
                    echo "========================================"

                    # Runtime secrets must come from Jenkins credentials, never from the repo.
                    TRACKED=$(git ls-files | grep -E '(^|/)\\.env$|(^|/)\\.env\\.(local|production)$|^config\\.yml$|^config\\.json$|\\.pem$' || true)

                    if [ -n "$TRACKED" ]; then
                        echo "FAILED: these secret/config files are committed to the repository:"
                        echo "$TRACKED"
                        echo "Remove them from git, add them to .gitignore, and rotate every credential they contained."
                        exit 1
                    fi

                    echo "No secret files are tracked in git."
                '''
            }
        }

        stage('Security Gate: Secret Scan') {
            steps {
                sh '''
                    set -e

                    echo "Running gitleaks on the source tree..."

                    # --redact keeps secret values out of the console log and report
                    docker run --rm \
                        -v "${APP_HOME}:/repo" \
                        "${GITLEAKS_IMG}" detect \
                        --source /repo \
                        --no-git \
                        --redact \
                        --report-format json \
                        --report-path /repo/reports/gitleaks.json \
                        --exit-code 1

                    echo "Secret scan passed: no hard-coded secrets found."
                '''
            }
        }

        stage('Configure Environment') {
            steps {
                withCredentials([
                    string(credentialsId: 'github-integration-mongodb-uri', variable: 'TD_MONGODB_URI'),
                    string(credentialsId: 'github-integration-jwt-secret',  variable: 'TRUDESK_JWTSECRET')
                ]) {
                    sh '''
                        set -e

                        echo "Writing runtime environment file from Jenkins credentials..."

                        umask 077
                        {
                            echo "NODE_ENV=production"
                            echo "PORT=${APP_PORT}"
                            echo "TD_MONGODB_URI=${TD_MONGODB_URI}"
                            echo "TRUDESK_JWTSECRET=${TRUDESK_JWTSECRET}"
                        } > "${APP_HOME}/.env.runtime"
                        chmod 600 "${APP_HOME}/.env.runtime"

                        # Validate required variables without printing secrets
                        for key in NODE_ENV PORT TD_MONGODB_URI TRUDESK_JWTSECRET; do
                            grep -q "^${key}=." "${APP_HOME}/.env.runtime" || { echo "Missing ${key}"; exit 1; }
                        done

                        echo "Environment configured (values hidden)."
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
                    if [ "$NODE_MAJOR" -lt 16 ]; then
                        echo "FAILED: Node.js >= 16 is required (found $(node -v))."
                        exit 1
                    fi
                    echo "Node $(node -v), Yarn $(${YARN} --version)"

                    # --immutable: fail if yarn.lock would change (reproducible build)
                    ${YARN} install --immutable

                    echo "Dependencies installed."
                '''
            }
        }

        stage('Quality Gate: Lint') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    echo "Running standard lint (package.json: lint)..."

                    ${YARN} run lint

                    echo "Lint passed."
                '''
            }
        }

        stage('Quality Gate: Unit Tests & Coverage') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    echo "Starting a throwaway MongoDB for the test suite..."

                    docker run -d --rm --name "${TEST_MONGO}" -p 27017:27017 "${MONGO_IMG}"

                    for i in $(seq 1 30); do
                        docker exec "${TEST_MONGO}" mongo --quiet --eval 'db.runCommand({ ping: 1 }).ok' >/dev/null 2>&1 && break
                        sleep 2
                    done

                    echo "Running tests with coverage (package.json: coverage)..."

                    ${YARN} run coverage

                    echo "Checking coverage threshold: ${MIN_COVERAGE}% lines..."

                    npx --no-install nyc report --reporter=text-summary | tee "${REPORTS}/coverage-summary.txt"
                    npx --no-install nyc check-coverage --lines "${MIN_COVERAGE}"

                    cp coverage/lcov.info "${REPORTS}/lcov.info" 2>/dev/null || true

                    echo "Tests and coverage gate passed."
                '''
            }
            post {
                always {
                    sh 'docker rm -f "${TEST_MONGO}" >/dev/null 2>&1 || true'
                }
            }
        }

        stage('Security Gate: Dependency Audit (SCA)') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    echo "Auditing dependencies (fail on ${AUDIT_SEVERITY} and above)..."

                    # Full report for the auditor, then the enforcing run
                    ${YARN} npm audit --all --recursive --json > "${REPORTS}/dependency-audit.json" || true

                    ${YARN} npm audit --all --recursive --severity "${AUDIT_SEVERITY}"

                    echo "Dependency audit passed."
                '''
            }
        }

        stage('Security Gate: Static Analysis (SAST)') {
            steps {
                sh '''
                    set -e

                    echo "Running Semgrep (JavaScript + Node.js security rules)..."

                    docker run --rm \
                        -v "${APP_HOME}:/src" \
                        -w /src \
                        "${SEMGREP_IMG}" semgrep scan \
                        --config p/javascript \
                        --config p/nodejsscan \
                        --severity ERROR \
                        --exclude node_modules \
                        --exclude "public/js/vendor" \
                        --exclude "public/js/plugins" \
                        --json --output reports/semgrep.json \
                        --error

                    echo "SAST passed: no high-severity findings."
                '''
            }
        }

        stage('Quality Gate: Build') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    echo "Building production assets (package.json: build → grunt build)..."

                    ${YARN} run build

                    test -d public/js
                    echo "Build completed. Output:"
                    ls -lah public/js | head -20
                '''
            }
        }

        stage('Security Gate: Container Image Scan') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    echo "Building image ${IMAGE_TAG} from Dockerfile..."

                    docker build -t "${IMAGE_TAG}" .

                    echo "Scanning image for HIGH/CRITICAL vulnerabilities..."

                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v "${REPORTS}:/reports" \
                        "${TRIVY_IMG}" image \
                        --severity HIGH,CRITICAL \
                        --ignore-unfixed \
                        --format json --output /reports/trivy-image.json \
                        --exit-code 1 \
                        "${IMAGE_TAG}"

                    echo "Container image scan passed."
                '''
            }
        }

        stage('Production Approval') {
            steps {
                script {
                    def commitAuthor = sh(script: "git log -1 --format='%an'", returnStdout: true).trim()

                    timeout(time: 30, unit: 'MINUTES') {
                        env.APPROVER = input(
                            message: "All gates passed. Deploy ${env.APP_NAME} build #${env.BUILD_NUMBER} to production?",
                            ok: 'Approve deployment',
                            submitter: env.DEPLOY_APPROVERS,
                            submitterParameter: 'APPROVER'
                        )
                    }

                    // Segregation of duties: the person who wrote the change cannot approve it.
                    if (env.APPROVER.equalsIgnoreCase(commitAuthor)) {
                        error("Approval rejected: ${env.APPROVER} is the author of the commit being deployed.")
                    }

                    echo "Deployment approved by ${env.APPROVER} (commit author: ${commitAuthor})."
                }
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -e

                    cd "${APP_HOME}"

                    # Load secrets into this shell only; pm2 keeps them for the process.
                    set -a
                    . "${APP_HOME}/.env.runtime"
                    set +a

                    if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then

                        echo "Restarting existing ${APP_NAME}..."

                        pm2 restart "${APP_NAME}" --update-env

                    else

                        echo "Starting ${APP_NAME} on port ${APP_PORT}..."

                        pm2 start "${APP_HOME}/runner.js" \
                            --name "${APP_NAME}" \
                            --cwd "${APP_HOME}"

                    fi
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    echo "Checking ${APP_NAME} on port ${APP_PORT} (/healthz)..."

                    curl --fail --silent --show-error \
                        --retry 12 --retry-delay 5 --retry-all-errors \
                        "http://127.0.0.1:${APP_PORT}/healthz" \
                        >/dev/null

                    echo "Health check passed."
                '''
            }
        }

        stage('PM2 Status') {
            steps {
                sh '''
                    echo "Saving PM2 process list..."

                    pm2 save

                    echo "Current PM2 processes:"
                    pm2 list
                '''
            }
        }
    }

    post {

        always {
            // Evidence for the audit: every gate's report, kept with the build
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true, fingerprint: true
            sh '''
                rm -f "${APP_HOME}/.env.runtime" || true
                docker rm -f "${TEST_MONGO}" >/dev/null 2>&1 || true
            '''
        }

        success {
            echo "========================================"
            echo "Github_integration (Trudesk) Deployment Successful"
            echo "========================================"
            echo "Approved by : ${env.APPROVER}"
            echo "Application : http://SERVER_IP:8118"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "Github_integration (Trudesk) Pipeline Failed"
            echo "A quality or security gate blocked this build."
            echo "See the stage above and the archived reports/."
            echo "========================================"

            sh '''
                echo "PM2 status:"
                pm2 list || true

                echo "Application logs:"
                pm2 logs trudesk --lines 30 --nostream || true
            '''
        }
    }
}
