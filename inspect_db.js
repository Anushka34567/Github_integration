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

console.log('Connecting to:', CONNECTION_URI);

mongoose.connect(CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            const groups = await mongoose.connection.db.collection('groups').find({}).toArray();
            console.log('Groups:', JSON.stringify(groups, null, 2));

            const users = await mongoose.connection.db.collection('accounts').find({}).toArray();
            console.log('Users count:', users.length);
            // Log the first few users to check structure and IDs
            console.log('First 3 Users:', JSON.stringify(users.slice(0, 3), null, 2));

        } catch (err) {
            console.error('Error querying DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
