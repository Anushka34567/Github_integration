const mongoose = require('mongoose');
const path = require('path');
const nconf = require('nconf');

nconf.file({
    file: path.join(__dirname, 'config.yml'),
    format: require('nconf-yaml')
});

const mongoConnectionUri = {
    server: nconf.get('mongo:host'),
    port: nconf.get('mongo:port') || '27017',
    username: nconf.get('mongo:username'),
    password: nconf.get('mongo:password'),
    database: nconf.get('mongo:database'),
    shard: nconf.get('mongo:shard')
};

let CONNECTION_URI = '';
if (mongoConnectionUri.shard === true) {
    CONNECTION_URI = 'mongodb+srv://' + encodeURIComponent(mongoConnectionUri.username) + ':' + encodeURIComponent(mongoConnectionUri.password) + '@' + mongoConnectionUri.server + '/' + mongoConnectionUri.database;
} else {
    CONNECTION_URI = 'mongodb://' + mongoConnectionUri.server + ':' + mongoConnectionUri.port + '/' + mongoConnectionUri.database;
}

mongoose.connect(CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            const adminUser = await mongoose.connection.db.collection('accounts').findOne({ username: 'admin' });
            if (!adminUser) {
                console.error('Admin user not found!');
                return;
            }

            // 1. Add admin to ALL groups directly (safety net)
            const groups = await mongoose.connection.db.collection('groups').find({}).toArray();
            for (const group of groups) {
                if (!group.members.map(String).includes(String(adminUser._id))) {
                    await mongoose.connection.db.collection('groups').updateOne(
                        { _id: group._id },
                        { $push: { members: adminUser._id } }
                    );
                    console.log(`Added admin to group: ${group.name}`);
                }
            }

            // 2. Ensure admin is in the "Support" team (or create one) and link it to a Department with "All Groups" access
            // This is the proper way for Admins/Agents to see tickets.

            let supportTeam = await mongoose.connection.db.collection('teams').findOne({ name: 'Support' });
            if (!supportTeam) {
                // Create Support Team
                const result = await mongoose.connection.db.collection('teams').insertOne({
                    name: 'Support',
                    members: [adminUser._id]
                });
                supportTeam = await mongoose.connection.db.collection('teams').findOne({ _id: result.insertedId });
                console.log('Created Support Team');
            } else {
                if (!supportTeam.members.map(String).includes(String(adminUser._id))) {
                    await mongoose.connection.db.collection('teams').updateOne(
                        { _id: supportTeam._id },
                        { $push: { members: adminUser._id } }
                    );
                    console.log('Added admin to Support Team');
                }
            }

            let supportDept = await mongoose.connection.db.collection('departments').findOne({ name: 'Support' });
            if (!supportDept) {
                // Create Support Department
                await mongoose.connection.db.collection('departments').insertOne({
                    name: 'Support',
                    normalized: 'support',
                    teams: [supportTeam._id],
                    allGroups: true,
                    publicGroups: false,
                    groups: []
                });
                console.log('Created Support Department with All Groups access');
            } else {
                if (!supportDept.teams.map(String).includes(String(supportTeam._id))) {
                    await mongoose.connection.db.collection('departments').updateOne(
                        { _id: supportDept._id },
                        { $push: { teams: supportTeam._id } }
                    );
                    console.log('Linked Support Team to Support Department');
                }
                if (!supportDept.allGroups) {
                    await mongoose.connection.db.collection('departments').updateOne(
                        { _id: supportDept._id },
                        { $set: { allGroups: true } }
                    );
                    console.log('Enabled All Groups access for Support Department');
                }
            }

        } catch (err) {
            console.error('Error updating DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
