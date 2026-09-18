const mongoose = require('mongoose');
const _ = require('lodash');

// Connection string from test_db_verbose.js
const user = encodeURIComponent('31aryanagivale_db_user');
const pass = encodeURIComponent('Aryan@1708');
const hosts = [
    'ac-6usbz9f-shard-00-00.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-01.xjzj78s.mongodb.net:27017',
    'ac-6usbz9f-shard-00-02.xjzj78s.mongodb.net:27017'
].join(',');
const dbName = 'trudesk';

const uri = `mongodb://${user}:${pass}@${hosts}/${dbName}?ssl=true&replicaSet=atlas-6usbz9f-shard-0&authSource=admin&retryWrites=true&w=majority`;

// Require Models (paths relative to project root, assuming we run from root)
const Ticket = require('./src/models/ticket');
const User = require('./src/models/user');
const Group = require('./src/models/group');
const Role = require('./src/models/role');

mongoose.connection.on('connected', () => console.log('Mongoose: Connected'));
mongoose.connection.on('error', (err) => console.error('Mongoose: Error', err));

async function run() {
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 5000,
            family: 4
        });
        console.log('Connected to DB');

        // 1. Fetch Users
        const usernames = ['rahul', 'demo', 'admin'];
        // Note: admin might be named differently, so we'll search by role later if not found?
        // But for now, let's try these usernames.
        // Also fetch ALL users to check their IDs against Group members
        const users = await User.find({ username: { $in: usernames.map(u => new RegExp(u, 'i')) } }).populate('role');

        console.log('\n--- USERS ---');
        const userMap = {};
        for (const u of users) {
            console.log(`User: ${u.username} (ID: ${u._id})`);
            console.log(`  Role: ${u.role ? u.role.name : 'N/A'}`);
            console.log(`  Is Admin: ${u.role ? u.role.isAdmin : false}`);
            userMap[u.username.toLowerCase()] = u;
        }

        // 2. Fetch Groups and Members
        const groups = await Group.find({}).populate('members');
        console.log('\n--- GROUPS ---');
        const groupMap = {};
        for (const g of groups) {
            console.log(`Group: ${g.name} (ID: ${g._id})`);
            const memberNames = g.members.map(m => m.username);
            console.log(`  Members: ${memberNames.join(', ')}`);
            groupMap[g._id.toString()] = { name: g.name, members: memberNames, memberIds: g.members.map(m => m._id.toString()) };
        }

        // 3. Fetch Tickets
        const ticketUIDs = [15, 16, 17, 19, 20, 22];
        const tickets = await Ticket.find({ uid: { $in: ticketUIDs } })
            .populate('owner')
            .populate('assignee')
            .populate('group');

        console.log('\n--- TICKETS ---');
        for (const t of tickets) {
            console.log(`Ticket #${t.uid}`);
            console.log(`  Subject: ${t.subject}`);
            console.log(`  Group: ${t.group ? t.group.name : 'Unknown'}`);
            console.log(`  Owner: ${t.owner ? t.owner.username : 'Unknown'}`);
            console.log(`  Assignee: ${t.assignee ? t.assignee.username : 'None'}`);
        }

        // 4. Analysis
        console.log('\n--- ANALYSIS ---');
        console.log('Checking why users see certain tickets...');

        for (const username of usernames) {
            const u = userMap[username];
            if (!u) {
                console.log(`User ${username} not found!`);
                continue;
            }

            console.log(`\nUser: ${u.username} (${u.role.name})`);

            if (u.role.isAdmin) {
                console.log(`  -> Is Admin: Should see ALL tickets.`);
                continue;
            }

            for (const t of tickets) {
                let canSee = false;
                let reason = [];

                // Logic 1: Apply to Group?
                if (t.group) {
                    const gInfo = groupMap[t.group._id.toString()];
                    if (gInfo && gInfo.memberIds.includes(u._id.toString())) {
                        canSee = true;
                        reason.push(`User is member of Group '${gInfo.name}'`);
                    }
                }

                // Logic 2: Owner?
                if (t.owner && t.owner._id.toString() === u._id.toString()) {
                    canSee = true;
                    reason.push(`User is Owner`);
                }

                // Logic 3: Assignee?
                if (t.assignee && t.assignee._id.toString() === u._id.toString()) {
                    canSee = true;
                    reason.push(`User is Assignee`);
                }

                if (canSee) {
                    console.log(`  [Visible] Ticket #${t.uid}: ${reason.join(', ')}`);
                } else {
                    console.log(`  [HIDDEN]  Ticket #${t.uid}: User is NOT in group '${t.group ? t.group.name : '?'}' AND not owner/assignee.`);
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
