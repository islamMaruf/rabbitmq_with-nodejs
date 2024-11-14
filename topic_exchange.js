const amqp = require('amqplib');
const config = require('./config');

// Array of messages and routing keys
const messages = [
    { routingKey: 'kern.critical', message: 'Kernel critical error' },
    { routingKey: 'anonymous.info', message: 'Anonymous info log' },
    { routingKey: 'kern.warning', message: 'Kernel warning' },
    { routingKey: 'auth.info', message: 'Authentication info' }
];

const exchange = 'test_topic_logs';

(async () => {
    // Connect to RabbitMQ once and pass the channel to both functions
    const connection = await amqp.connect(config.base_url);
    const channel = await connection.createChannel();

    // Declare the topic exchange
    await channel.assertExchange(exchange, 'topic', { durable: false });

    // Call the publisher and consumer functions
    await publishMessages(channel);
    await consumeMessages(channel);
})();

// Publisher function
async function publishMessages(channel) {
    messages.forEach(({ routingKey, message }) => {
        channel.publish(exchange, routingKey, Buffer.from(message));
        console.log(`Sent message: '${message}' with routing key: '${routingKey}'`);
    });
}

// Consumer function
async function consumeMessages(channel) {
    // Declare queues and bind them to the exchange with specific routing keys
    const q1 = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(q1.queue, exchange, '*.info');
    console.log(`Queue bound to routing key: '*.info'`);

    const q2 = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(q2.queue, exchange, 'kern.*');
    console.log(`Queue bound to routing key: 'kern.*'`);

    // Consume messages from the first queue (bound to '*.info')
    channel.consume(q1.queue, (msg) => {
        console.log(`Received in '*.info' queue: ${msg.content.toString()}`);
    }, { noAck: true });

    // Consume messages from the second queue (bound to 'kern.*')
    channel.consume(q2.queue, (msg) => {
        console.log(`Received in 'kern.*' queue: ${msg.content.toString()}`);
    }, { noAck: true });
}
