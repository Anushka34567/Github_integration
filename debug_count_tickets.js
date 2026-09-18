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
            const ticketCount = await mongoose.connection.db.collection('tickets').countDocuments({});
            console.log('Total tickets in DB:', ticketCount);

            const tickets = await mongoose.connection.db.collection('tickets').find({}).toArray();
            console.log('Tickets:', JSON.stringify(tickets, null, 2));

        } catch (err) {
            console.error('Error querying DB:', err);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Connection error:', err);
    });
