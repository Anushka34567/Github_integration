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

console.log('Connecting to database to add demo user to groups...');

mongoose.connect(CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            const demoUser = await mongoose.connection.db.collection('accounts').findOne({ username: 'demo' });
            if (!demoUser) {
                console.error('Demo user not found!');
                return;
            }
            const groups = await mongoose.connection.db.collection('groups').find({}).toArray();

            for (const group of groups) {
                if (!group.members.map(String).includes(String(demoUser._id))) {
                    await mongoose.connection.db.collection('groups').updateOne(
                        { _id: group._id },
                        { $push: { members: demoUser._id } }
                    );
                    console.log(`Added demo user to group: ${group.name}`);
                } else {
                    console.log(`Demo user already in group: ${group.name}`);
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
