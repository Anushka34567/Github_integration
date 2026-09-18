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

console.log('Connecting to database to clean spam tickets...');

mongoose.connect(CONNECTION_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to MongoDB');
        try {
            const result = await mongoose.connection.db.collection('tickets').updateMany(
                { subject: 'deployement issues', deleted: false },
                { $set: { deleted: true } }
            );

            console.log(`Soft deleted ${result.modifiedCount} tickets with subject "deployement issues".`);

            // Force refresh cache might be required, but usually it auto-refreshes or on restart.
            // We can't easily trigger the app's cache refresh from this script.
            // The user might need to restart the app or wait 5 mins.

        } catch (err) {
            console.error('Error cleaning DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
