require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function manageUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const users = await mongoose.connection.db.collection('users').find({}).toArray();
        
        if (users.length === 0) {
            console.log('📭 No users found in database');
            await mongoose.disconnect();
            rl.close();
            process.exit(0);
        }
        
        console.log('👥 Current Users in Database:');
        console.log('═'.repeat(80));
        
        users.forEach((user, index) => {
            console.log(`\n${index + 1}. Email: ${user.email}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Active: ${user.isActive ? '✅ Yes' : '❌ No'}`);
            console.log(`   Has Token: ${user.activationToken ? '✅ Yes' : '❌ No'}`);
            console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
        });
        
        console.log('\n' + '═'.repeat(80));
        console.log('\nWhat would you like to do?');
        console.log('1. Delete specific email');
        console.log('2. Delete ALL users');
        console.log('3. Exit (no changes)');
        
        const choice = await question('\nEnter your choice (1/2/3): ');
        
        if (choice === '1') {
            const email = await question('\nEnter the email to delete: ');
            const result = await mongoose.connection.db.collection('users').deleteMany({ email: email.toLowerCase() });
            
            if (result.deletedCount > 0) {
                console.log(`\n✅ Successfully deleted ${result.deletedCount} user(s) with email: ${email}`);
            } else {
                console.log(`\n❌ No user found with email: ${email}`);
            }
        } else if (choice === '2') {
            const confirm = await question('\n⚠️  Are you sure you want to delete ALL users? (yes/no): ');
            
            if (confirm.toLowerCase() === 'yes') {
                const result = await mongoose.connection.db.collection('users').deleteMany({});
                console.log(`\n✅ Successfully deleted ${result.deletedCount} user(s)`);
            } else {
                console.log('\n❌ Deletion cancelled');
            }
        } else {
            console.log('\n👋 Exiting without changes');
        }
        
        await mongoose.disconnect();
        rl.close();
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        rl.close();
        process.exit(1);
    }
}

manageUsers();
