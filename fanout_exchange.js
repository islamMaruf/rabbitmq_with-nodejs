const amqp = require('amqplib');
const config = require('./config');

const exchange = 'unbind_ipn_receive_exchange_as_sol';  // Name of the fanout exchange

const msg = 'This is a broadcast message!';  // Message to broadcast

(async () => {
    // Connect to RabbitMQ once and pass the channel to both functions
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare the fanout exchange
    await channel.assertExchange(exchange, 'fanout', { durable: false });

    // Call the functions to set up queues and publish messages
    // await setupQueues(channel);
    await publishMessage(channel);
})();

// Function to set up queues and bind them to the fanout exchange
async function setupQueues(channel) {
    // // Declare two queues and bind them to the fanout exchange
    // const q1 = await channel.assertQueue('', { exclusive: false });
    // await channel.bindQueue(q1.queue, exchange, '');

    // const q2 = await channel.assertQueue('', { exclusive: false });
    // await channel.bindQueue(q2.queue, exchange, '');

    // console.log(`Queues are bound to the fanout exchange`);

    // Consume messages from both queues
    // channel.consume(q1.queue, (msg) => {
    //     console.log(`Received in queue 1: ${msg.content.toString()}`);
    // }, { noAck: true });

    // channel.consume(q2.queue, (msg) => {
    //     console.log(`Received in queue 2: ${msg.content.toString()}`);
    // }, { noAck: true });
}

// Function to publish messages to the fanout exchange
async function publishMessage(channel) {
    channel.publish(exchange, '', Buffer.from(msg));
    console.log(`Sent message: '${msg}'`);
}
