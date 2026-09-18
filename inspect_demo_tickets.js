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
            const demoUser = await mongoose.connection.db.collection('accounts').findOne({ username: 'demo' });
            if (!demoUser) {
                console.error('Demo user not found!');
                return;
            }
            console.log('Demo User ID:', demoUser._id);

            const tickets = await mongoose.connection.db.collection('tickets').find({ owner: demoUser._id }).toArray();
            console.log(`Found ${tickets.length} tickets for demo user.`);

            for (const ticket of tickets) {
                console.log(`Ticket UID: ${ticket.uid}, Group: ${ticket.group}, Deleted: ${ticket.deleted}`);
                // Check if group exists
                const group = await mongoose.connection.db.collection('groups').findOne({ _id: ticket.group });
                if (group) {
                    console.log(`  - Group Name: ${group.name}`);
                    const isMember = group.members.map(String).includes(String(demoUser._id));
                    console.log(`  - Demo user in group members? ${isMember}`);
                } else {
                    console.log(`  - Group ID ${ticket.group} NOT FOUND`);
                }
            }

        } catch (err) {
            console.error('Error querying DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
