const amqp = require('amqplib');
const config = require('./config');

const exchange = 'direct_logs';  // Name of the direct exchange
const routingKey = 'info';        // Routing key for the queue
const message = 'Hello, this is a direct exchange message!';  // Message to send

(async () => {
    // Connect to RabbitMQ
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare the direct exchange
    await channel.assertExchange(exchange, 'direct', { durable: false });

    // Set up the queue
    const {queue} = await channel.assertQueue('info_queue', { durable: false });

    // Bind the queue to the exchange with the routing key
    await channel.bindQueue(queue, exchange, routingKey);
    console.log(`Queue ${queue} bound to exchange '${exchange}' with routing key '${routingKey}'`);

    // Publish the message
    await publishMessage(channel, message);

    // Consume messages from the queue
    await consumeMessages(channel, queue);

})().catch(console.error);

// Function to publish messages to the direct exchange
async function publishMessage(channel, msg) {
    channel.publish(exchange, routingKey, Buffer.from(msg));
    console.log(`Sent message to '${exchange}' with routing key '${routingKey}': '${msg}'`);
}

// Function to consume messages from the queue
async function consumeMessages(channel, queue) {
    channel.consume(queue, (msg) => {
        if (msg !== null) {
            console.log(`Received in ${queue}: ${msg.content.toString()}`);
            channel.ack(msg); // Acknowledge the message
        }
    }, { noAck: false });
}
