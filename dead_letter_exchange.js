const amqp = require('amqplib');
const config = require('./config');
const mainQueue = 'test_main_queue';
const retryQueue = 'test_retry_queue';
const dlxQueue = 'test_dlx_queue';

async function setupQueues() {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    const dlx_exchange = 'test_dlx_exchange';
    const retry_exchange = 'test_retry_exchange';
    const retry_routing_key = 'test_retry_routing_key';
    const dlx_routing_key = "test_dlx_routing_key"


    // Create the DLX Exchange
    await channel.assertExchange(dlx_exchange, 'direct', { durable: true });

    // Create the retry exchange for messages to be retried after a delay
    await channel.assertExchange(retry_exchange, 'direct', { durable: true });

    // Create the main queue with a Dead Letter Exchange (DLX)
    await channel.assertQueue(mainQueue, {
        durable: true,
        deadLetterExchange: retry_exchange,
        deadLetterRoutingKey: retry_routing_key,  // Send failed messages to the DLX with the 'retry' routing key
    });

    // Create a retry queue with TTL (Time-To-Live)
    await channel.assertQueue(retryQueue, {
        durable: true,
        arguments: {
            'x-message-ttl': 10000,  // Wait for 10 seconds before retrying
            'x-dead-letter-exchange': dlx_exchange,  // After TTL, if consumer nacked then go to the dlx queue
            'x-dead-letter-routing-key': dlx_routing_key, // if exchange is empty and it is mainQueue then the message go to mainQueue
        },
    });

    // Create a final dead letter queue for messages that failed multiple retries
    await channel.assertQueue(dlxQueue, {
        durable: true,
    });

    // Bind the retry queue to the retry exchange
    await channel.bindQueue(retryQueue, retry_exchange, retry_routing_key);

    // Bind the final DLX queue to handle messages that should no longer be retried
    await channel.bindQueue(dlxQueue, dlx_exchange, dlx_routing_key);

    console.log('Queues and exchanges set up successfully');
    return channel;
}

async function sendMessage(channel, queueName, message) {
    await channel.sendToQueue(queueName, Buffer.from(message), { persistent: true });
    console.log(`Sent message: ${message} : queue_name: ${queueName}`);
}

async function consumeMessages(channel, queueName) {
    await channel.consume(queueName, async (msg) => {
        if (msg) {
            const content = msg.content.toString();
            console.log(`Received message: ${content} | Queue name: ${queueName}`);

            // Simulate message processing failure
            if (Math.random() < 0.5) {
                console.log(`Message processing failed, sending to DLX.`);
                channel.nack(msg, false, false);  // Send to DLX for retry
            } else {
                console.log(`Message processed successfully from queue: ${queueName}`);
                channel.ack(msg);  // Acknowledge the message
            }
        }
    }, { noAck: false });
}

(async function () {
    const channel = await setupQueues();
    let order_id = `order-${Math.random(10000,99999)}}`
    // Send a message to the main queue
    await sendMessage(channel, mainQueue, order_id);

    // Start consuming messages from the main queue
    consumeMessages(channel, mainQueue);

    // Start consuming messages from the retry queue
    consumeMessages(channel, retryQueue);

    // Start consuming messages from the dlx queue
    consumeMessages(channel, dlxQueue);

})();
