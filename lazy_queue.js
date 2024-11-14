const amqp = require('amqplib');
const config = require('./config');

(async () => {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare a Lazy Queue
    const queueName = 'lazy_queue';
    await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
            'x-queue-type': 'lazy' // Specify the queue type as lazy
        }
    });

    console.log(`Lazy Queue '${queueName}' created.`);

    // Publish a message to the lazy queue
    const message = 'This is a message for the lazy queue!';
    channel.sendToQueue(queueName, Buffer.from(message), { persistent: true });
    console.log(`Sent message: '${message}' to '${queueName}'`);

    // Cleanup
    setTimeout(() => {
        channel.close();
        connection.close();
    }, 500);
})();
