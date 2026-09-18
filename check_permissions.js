const mongoose = require('mongoose');
const _ = require('lodash');

// Connection from test_db_verbose.js
const user = encodeURIComponent('31aryanagivale_db_user');
const pass = encodeURIComponent('Aryan@1708');
const hosts = [
    'ac-6usbz9f-shard-00-00.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-01.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-02.xjzj78s.mongodb.net:27017'
].join(',');
const dbName = 'trudesk';
const uri = `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&replicaSet=atlas-6usbz9f-shard-0&authSource=admin&retryWrites=true&w=majority`;

// Models
const Ticket = require('./src/models/ticket');
const User = require('./src/models/user');
const Group = require('./src/models/group');
const Department = require('./src/models/department');
const Team = require('./src/models/team');

// Mongoose Connection
mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000, // Increased timeout
    socketTimeoutMS: 45000, // Increased timeout
    family: 4
}).then(() => {
    console.log('Connected to DB');
    runAnalysis();
}).catch(err => {
    console.error('DB Connection Failed:', err.message);
    process.exit(1);
});

async function runAnalysis() {
    try {
        console.log('\n--- VISIBILITY ANALYSIS START ---\n');

        // 1. Find the User 'demo' (or whoever sees 22 and 20)
        // We'll search for users with usernames 'demo', 'rahul' to compare
        const targetUsers = await User.find({ username: { $in: ['demo', 'rahul', 'admin'] } }).populate('role');

        // 2. Find the Tickets in question
        const targetTicketUIDs = [15, 16, 17, 19, 20, 22];
        const tickets = await Ticket.find({ uid: { $in: targetTicketUIDs } }).populate('group owner assignee');

        // 3. Analyze each user
        for (const u of targetUsers) {
            console.log(`\n### Analysis for User: ${u.username} (${u.role.name}) ###`);

            // Get User's Teams and Departments
            const teams = await Team.find({ members: u._id });
            const teamIds = teams.map(t => t._id);
            const departments = await Department.find({ teams: { $in: teamIds } });

            console.log(`  Teams: ${teams.map(t => t.name).join(', ')}`);
            console.log(`  Departments: ${departments.map(d => d.name).join(', ')}`);

            // Determine Allowed Groups for this User (Agent Logic)
            let allowedGroupIds = [];
            let accessAll = false;

            for (const d of departments) {
                if (d.allGroups) {
                    accessAll = true;
                    console.log(`    -> Department '${d.name}' grants ACCESS TO ALL GROUPS.`);
                } else {
                    console.log(`    -> Department '${d.name}' allows groups: ${d.groups.join(', ')}`);
                    allowedGroupIds = allowedGroupIds.concat(d.groups.map(g => g.toString()));
                }
            }

            // Check Visibility for each Ticket
            console.log(`  -- Ticket Visibility Check --`);
            for (const t of tickets) {
                const tGroup = t.group;
                if (!tGroup) {
                    console.log(`    Ticket #${t.uid}: [ERROR] No Group assigned!`);
                    continue;
                }

                let reason = "HIDDEN";
                let visible = false;

                // 1. Admin/All Groups Override
                if (u.role.isAdmin || accessAll) {
                    visible = true;
                    reason = "VISIBLE (Admin/All Groups Access)";
                }
                // 2. Department Group Access
                else if (allowedGroupIds.includes(tGroup._id.toString())) {
                    visible = true;
                    reason = `VISIBLE (Group '${tGroup.name}' is in Department)`;
                }
                // 3. Public Group? (Simplification)
                else if (tGroup.public) {
                    // logic might vary but let's note it
                    reason = "HIDDEN (Public Group, but check Public Ticket settings)";
                }
                // 4. Assignee/Owner
                else if ((t.assignee && t.assignee._id.equals(u._id)) || (t.owner && t.owner._id.equals(u._id))) {
                    visible = true;
                    reason = "VISIBLE (User is Assignee/Owner)";
                }
                else {
                    reason = `HIDDEN (Group '${tGroup.name}' NOT in User's Departments)`;
                }

                // Highlight the 22 and 20 case
                const isTarget = [20, 22].includes(t.uid);
                const mark = isTarget ? "  >>" : "    ";
                console.log(`${mark} Ticket #${t.uid} (Group: ${tGroup.name}): ${reason}`);
            }
        }

        console.log('\n--- ANALYSIS COMPLETE ---');
        process.exit(0);

    } catch (err) {
        console.error('Analysis Error:', err);
        process.exit(1);
    }
}
