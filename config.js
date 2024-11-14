require('dotenv').config();

module.exports = {
    base_url: `amqps://${process.env.RABBITMQ_USERNAME}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}/${process.env.RABBITMQ_VHOST}`
};