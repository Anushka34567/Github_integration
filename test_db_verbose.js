const mongoose = require('mongoose');

const user = encodeURIComponent('31aryanagivale_db_user');
const pass = encodeURIComponent('Aryan@1708');
const hosts = [
    'ac-6usbz9f-shard-00-00.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-01.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-02.xjzj78s.mongodb.net:27017'
].join(',');
const dbName = 'trudesk';

// Try minimal options first
const uri = `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&replicaSet=atlas-6usbz9f-shard-0&authSource=admin&retryWrites=true&w=majority`;

console.log('Test Script Starting...');
console.log('URI:', uri.replace(pass, '****'));

mongoose.connection.on('connected', () => console.log('Mongoose: Connected'));
mongoose.connection.on('error', (err) => console.error('Mongoose: Error', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose: Disconnected'));

mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
    family: 4 // Force IPv4
})
    .then(() => {
        console.log('Connected successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed details:', JSON.stringify(err, null, 2));
        console.error('Stack:', err.stack);
        process.exit(1);
    });
