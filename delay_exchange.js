const amqp = require('amqplib');
const config = require('./config');

(async () => {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare a delay exchange
    const exchangeName = 'delayed_exchange';
    await channel.assertExchange(exchangeName, 'x-delayed-message', {
        durable: true,
        arguments: { 'x-delayed-type': 'direct' } // Specify the type of the underlying exchange
    });

    // Declare a queue and bind it to the delay exchange
    const queueName = 'delayed_queue';
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, exchangeName, 'my_routing_key');

    // Publish a message with a delay (e.g., 5000ms)
    const delay = 5000; // Delay in milliseconds
    const message = 'This message will be delayed!';
    channel.publish(exchangeName, 'my_routing_key', Buffer.from(message), {
        headers: { 'x-delay': delay } // Specify the delay in the message headers
    });
    console.log(`Sent message: '${message}' with a delay of ${delay}ms`);

    // Consume messages from the queue
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
    }, 10000); // Keep the connection open for a while to receive the delayed message
})();
