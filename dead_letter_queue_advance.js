const amqp = require('amqplib');
const config = require('./config');

const maxRetries = 3; // Maximum number of retries
const nameSpace = "dead_letter_queue_advance";
const mainQueue = `${nameSpace}_main_queue`;
const retryQueue = `${nameSpace}_retry_queue`;
const dlxQueue = `${nameSpace}_dlx_queue`;
const dlxExchange = `${nameSpace}_dlx_exchange`;  // DLX Exchange
const retryExchange = `${nameSpace}_retry_exchange`; // Retry Exchange
const retryRoutingKey = `${nameSpace}_retry_routing_key`;
const dlxRoutingKey = `${nameSpace}_dlx_routing_key`

async function setupQueues() {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Create the DLX Exchange
    await channel.assertExchange(dlxExchange, 'direct', { durable: true });

    // Create the retry exchange for messages to be retried after a delay
    await channel.assertExchange(retryExchange, 'direct', { durable: true });

    // Create the main queue with a Dead Letter Exchange (DLX)
    await channel.assertQueue(mainQueue, {
        durable: true,
        deadLetterExchange: retryExchange,
        deadLetterRoutingKey: retryRoutingKey // Send failed messages to the DLX with the 'retry' routing key
    });

    // Create a retry queue with TTL (Time-To-Live)
    await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
            'x-message-ttl': 10000,  // Wait for 10 seconds before retrying
            'x-dead-letter-exchange': dlxExchange,  // After TTL, route back to retry exchange
            'x-dead-letter-routing-key': dlxRoutingKey,
        },
    });

    // Create a final dead letter queue for messages that failed multiple retries
    await channel.assertQueue(dlxQueue, {
        durable: true,
    });

    // Bind the retry queue to the retry exchange
    await channel.bindQueue(retryQueue, retryExchange, retryRoutingKey);

    // Bind the final DLX queue to handle messages that should no longer be retried
    await channel.bindQueue(dlxQueue, dlxExchange, dlxRoutingKey);

    console.log('Queues and exchanges set up successfully');
    return channel;
}

async function sendMessage(channel, queueName, message, retries = 0) {
    const messageOptions = {
        persistent: true,
        headers: {
            'x-retry-count': retries, // Set the retry count in the headers
        },
    };

    await channel.sendToQueue(queueName, Buffer.from(message), messageOptions);
    console.log(`Sent message: ${message} with retry count: ${retries}`);
}

async function consumeMessages(channel, queueName) {
    await channel.consume(queueName, async (msg) => {
        if (msg) {
            const content = msg.content.toString();
            const retryCount = msg.properties.headers['x-retry-count'] || 0; // Get the current retry count
            console.log(`Received message: ${content} with retry count: ${retryCount}`);

            // Simulate message processing failure
            if (Math.random() < 0.5) {
                if (retryCount < maxRetries) {
                    console.log('Message processing failed, sending to DLX for retry...');
                    // Increment the retry count
                    sendMessage(channel, retryQueue, content, retryCount + 1);
                    channel.nack(msg, false, false);  // Send to retry for retry
                } else {
                    console.log('Max retries reached, sending to final DLX...');
                    sendMessage(channel, dlxQueue, content, retryCount + 1);
                    channel.ack(msg, false, false); // Send to final DLX
                }
            } else {
                console.log('Message processed successfully');
                channel.ack(msg);  // Acknowledge the message
            }
        }
    }, { noAck: false });
}

(async function () {
    const channel = await setupQueues();

    // Send a message to the main queue
    await sendMessage(channel, mainQueue, 'Order #12345');

    // Start consuming messages from the main queue
    consumeMessages(channel, mainQueue);
    consumeMessages(channel, retryQueue);
    consumeMessages(channel, dlxQueue);
})();
