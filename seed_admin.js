const path = require('path');
const nconf = require('nconf');
const _ = require('lodash');

// Load config like app.js does
nconf.file({
    file: path.join(__dirname, 'config.yml'),
    format: require('nconf-yaml')
});

const database = require('./src/database');
const Role = require('./src/models/role');
const User = require('./src/models/user');

console.log('Connecting to database...');

database.init(function (err, db) {
    if (err) {
        console.error('Failed to connect:', err);
        process.exit(1);
    }

    console.log('Connected. Looking for Admin role...');

    Role.getRoleByName('Admin', function (err, adminRole) {
        if (err) {
            console.error('Error finding Admin role:', err);
            process.exit(1);
        }
        if (!adminRole) {
            console.error('Admin role not found! Run the app at least once to trigger migrations.');
            process.exit(1);
        }

        console.log('Found Admin role ID:', adminRole._id);

        User.getByUsername('admin', function (err, existingUser) {
            if (err) {
                console.error(err);
                process.exit(1);
            }
            if (existingUser) {
                console.log('User "admin" already exists.');
                process.exit(0);
            }

            console.log('Creating admin user...');
            const newUser = new User({
                username: 'admin',
                fullname: 'Administrator',
                email: 'admin@example.com',
                password: 'password',
                role: adminRole._id
            });

            newUser.save(function (err) {
                if (err) {
                    console.error('Failed to create user:', err);
                    process.exit(1);
                }
                console.log('SUCCESS: User "admin" created with password "password".');
                process.exit(0);
            });
        });
    });
});
