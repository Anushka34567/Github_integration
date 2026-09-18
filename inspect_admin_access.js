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
            console.log('Admin User ID:', adminUser._id);

            // Check direct group membership
            const groups = await mongoose.connection.db.collection('groups').find({ members: adminUser._id }).toArray();
            console.log(`Admin is directly a member of ${groups.length} groups:`, groups.map(g => g.name));

            // Check departments and their groups
            // Teams of user
            const teams = await mongoose.connection.db.collection('teams').find({ members: adminUser._id }).toArray();
            console.log(`Admin is a member of ${teams.length} teams:`, teams.map(t => t.name));

            const teamIds = teams.map(t => t._id);
            const departments = await mongoose.connection.db.collection('departments').find({ teams: { $in: teamIds } }).toArray();
            console.log(`Admin belongs to ${departments.length} departments:`, departments.map(d => d.name));

            for (const dept of departments) {
                console.log(`Department: ${dept.name}`);
                console.log(` - All Groups: ${dept.allGroups}`);
                console.log(` - Public Groups: ${dept.publicGroups}`);
                console.log(` - Specific Groups: ${dept.groups ? dept.groups.length : 0}`);
            }

            // Check tickets
            const tickets = await mongoose.connection.db.collection('tickets').find({}).toArray();
            console.log('Total Tickets in DB:', tickets.length);
            tickets.forEach(t => {
                console.log(`Ticket ${t.uid}: Group ${t.group}, Owner ${t.owner}`);
            });

        } catch (err) {
            console.error('Error querying DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
