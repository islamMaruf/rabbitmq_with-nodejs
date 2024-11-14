const amqp = require('amqplib');
const config = require('./config');

const exchange = 'header_notifications'; // Name of the header exchange
const queueAdmin = 'admin_notifications'; // Queue for admin notifications
const queueUser = 'user_notifications'; // Queue for user notifications

(async () => {
    // Connect to RabbitMQ
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare the header exchange
    await channel.assertExchange(exchange, 'headers', { durable: true });

    // Set up admin notifications queue
    await channel.assertQueue(queueAdmin, { durable: true });
    await channel.bindQueue(queueAdmin, exchange, '', {
        'x-match': 'all', // Match all headers
        'role': 'admin',  // Only for admin role
        'type': 'alert'   // Only alert type notifications
    });

    // Set up user notifications queue
    await channel.assertQueue(queueUser, { durable: true });
    await channel.bindQueue(queueUser, exchange, '', {
        'x-match': 'all', // Match all headers
        'role': 'user',   // Only for user role
        'type': 'info'    // Only info type notifications
    });

    console.log(`Queues ${queueAdmin} and ${queueUser} are bound to exchange '${exchange}' with headers`);

    // Publish messages
    await publishMessage(channel, 'Important alert for admins!', { role: 'admin', type: 'alert' });
    await publishMessage(channel, 'General info for users.', { role: 'user', type: 'info' });
    await publishMessage(channel, 'This is an alert for users.', { role: 'user', type: 'alert' });

    // Consume messages
    await consumeMessages(channel, queueAdmin, 'Admin Notifications');
    await consumeMessages(channel, queueUser, 'User Notifications');

})().catch(console.error);

// Function to publish messages to the header exchange
async function publishMessage(channel, msg, headers) {
    channel.publish(exchange, '', Buffer.from(msg), { headers });
    console.log(`Sent message to '${exchange}': '${msg}' with headers`, headers);
}

// Function to consume messages from the queue
async function consumeMessages(channel, queue, consumerName) {
    channel.consume(queue, (msg) => {
        if (msg !== null) {
            console.log(`[${consumerName}] Received: ${msg.content.toString()}`);
            channel.ack(msg); // Acknowledge the message
        }
    }, { noAck: false });
}
