const amqp = require('amqplib');
const config = require('./config');

(async () => {
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare the main exchange
    const mainExchange = 'main_exchange';
    await channel.assertExchange(mainExchange, 'direct', { durable: true });

    // Declare the alternative exchange
    const altExchange = 'alt_exchange';
    await channel.assertExchange(altExchange, 'fanout', { durable: true });

    // Declare a queue for the main exchange
    const mainQueue = 'main_queue';
    await channel.assertQueue(mainQueue, { durable: true });
    await channel.bindQueue(mainQueue, mainExchange, 'main_routing_key');

    // Declare a queue for the alternative exchange
    const altQueue = 'alt_queue';
    await channel.assertQueue(altQueue, { durable: true });
    await channel.bindQueue(altQueue, altExchange, '');

    // Setup the main exchange with the alternative exchange
    await channel.assertExchange(mainExchange, 'direct', {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': altExchange // Specify the alternative exchange
        }
    });

    // Publish a message to the main exchange
    const message = 'This message cannot be routed!';
    channel.publish(mainExchange, 'non_existent_key', Buffer.from(message)); // Intentionally using a non-existent routing key
    console.log(`Sent message: '${message}' to '${mainExchange}'`);

    // Consume messages from the alternative exchange queue
    channel.consume(altQueue, (msg) => {
        if (msg !== null) {
            console.log(`Received message in alt queue: '${msg.content.toString()}'`);
            channel.ack(msg); // Acknowledge the message
        }
    });

    // Cleanup
    setTimeout(() => {
        channel.close();
        connection.close();
    }, 5000);
})();
