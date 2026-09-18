const mongoose = require('mongoose');

// Manually resolved hosts from nslookup
// ac-6usbz9f-shard-00-00.xjzj78s.mongodb.net:27017
// ac-6usbz9f-shard-00-01.xjzj78s.mongodb.net:27017
// ac-6usbz9f-shard-00-02.xjzj78s.mongodb.net:27017

const user = encodeURIComponent('31aryanagivale_db_user');
const pass = encodeURIComponent('Aryan@1708');
const hosts = [
    'ac-6usbz9f-shard-00-00.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-01.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-02.xjzj78s.mongodb.net:27017'
].join(',');
const dbName = 'trudesk';

// Standard connection string with replica set
const uri = `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&replicaSet=atlas-6usbz9f-shard-0&authSource=admin&retryWrites=true&w=majority`;

console.log('Testing connection to:', uri.replace(pass, '****'));

mongoose.connect(uri)
    .then(() => {
        console.log('Connected successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection failed:', err);
        process.exit(1);
    });
