`const amqp = require('amqplib');
const config = require('./config');

const mainQueue = 'main_queue';
const dlxQueue = 'dlx_queue';

async function setupQueues() {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Define exchanges for DLX
    const dlxExchange = 'dlx_exchange';
    const mainExchange = 'main_exchange';

    const mainRoutingKey= 'main_routing_key';
    const dlxRoutingKey='dlx_routing_key';

    // Create main exchange and queue
    await channel.assertExchange(mainExchange, 'direct', { durable: true });
    await channel.assertQueue(mainQueue, {
        durable: true,
        deadLetterExchange: dlxExchange,
        deadLetterRoutingKey: dlxRoutingKey
    });
    await channel.bindQueue(mainQueue, mainExchange, mainRoutingKey);

    // Create retry exchange and queue
    await channel.assertExchange(dlxExchange, 'direct', { durable: true });
    await channel.assertQueue(dlxQueue, {
        durable: true,
        arguments: {
            'x-message-ttl': 500, // Wait 500 ms before retrying
            'x-dead-letter-exchange': mainExchange, // After TTL, send back to the main exchange
            'x-dead-letter-routing-key': mainRoutingKey, // Route back to the main queue
        },
    });
    await channel.bindQueue(dlxQueue, dlxExchange, dlxRoutingKey);

    console.log('Queues and exchanges set up successfully');
    return channel;
}

async function sendMessage(channel, queueName, message) {
    await channel.sendToQueue(queueName, Buffer.from(message), { persistent: true });
    console.log(`Sent message: ${message} to queue: ${queueName}`);
}

async function consumeMessages(channel, queueName) {
    await channel.consume(queueName, async (msg) => {
        if (msg) {
            const content = msg.content.toString();
            console.log(`Received message: ${content} from queue: ${queueName}`);

            // Simulate message processing failure
            if (Math.random() < 0.5) {
                console.log(`Processing failed for message: ${content}, sending to retry queue.`);
                channel.nack(msg, false, false); // Send to DLX for retry
            } else {
                console.log(`Message processed successfully: ${content}`);
                channel.ack(msg); // Acknowledge the message
            }
        }
    }, { noAck: false });
}

(async function () {
    const channel = await setupQueues();

    // Send a message to the main queue
    const orderId = `order-${Math.floor(Math.random() * 100000)}`;
    await sendMessage(channel, mainQueue, orderId);

    // Start consuming messages from the main queue
    consumeMessages(channel, mainQueue);

    // Start consuming messages from the retry queue
    consumeMessages(channel, dlxQueue);
})();
`