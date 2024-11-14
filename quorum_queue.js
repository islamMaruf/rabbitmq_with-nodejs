const amqp = require('amqplib');

(async () => {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    const queueName = 'my_quorum_queue';

    // Declare a quorum queue
    await channel.assertQueue(queueName, {
        durable: true,
        'x-max-length': 1000, // Optional: maximum number of messages
        'x-queue-type': 'quorum' // Specify that this is a quorum queue
    });

    // Publish a message to the quorum queue
    const message = 'This is a message for the quorum queue!';
    channel.sendToQueue(queueName, Buffer.from(message));

    console.log(`Sent message: '${message}'`);

    // Consume messages from the quorum queue
    channel.consume(queueName, (msg) => {
        if (msg !== null) {
            console.log(`Received message: '${msg.content.toString()}'`);
            channel.ack(msg); // Acknowledge the message
        }
    });

    // Cleanup
    setTimeout(() => {
        channel.close();
        connection.close();
    }, 10000); // Allow 10 seconds for processing before closing
})();
