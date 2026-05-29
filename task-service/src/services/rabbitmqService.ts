import amqp, { Channel } from 'amqplib';
import {
  TASK_QUEUE_NAME,
  RABBITMQ_URL,
  RABBITMQ_RETRY_COUNT,
  RABBITMQ_RETRY_DELAY,
} from '../config/envConfig';
import logger from '../utils/logger';

let connection: any | null = null;
let channel: Channel | null = null;

const connectToRabbitMQ = async () => {
  let retries = RABBITMQ_RETRY_COUNT;

  while (retries) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      if (channel) {
        await channel.assertQueue(TASK_QUEUE_NAME, {
          durable: true,
          deadLetterExchange: `${TASK_QUEUE_NAME}.dlx`,
        });

        logger.info(`Connected to RabbitMQ and asserted queue: ${TASK_QUEUE_NAME}`);
      } else {
        throw new Error('Failed to create RabbitMQ channel');
      }

      break;
    } catch (err) {
      logger.error(`Could not connect to RabbitMQ: ${err}`);
      retries--;
      logger.info(`Retries left: ${retries}`);

      if (retries === 0) {
        logger.error('Giving up. Exiting.');
        process.exit(1);
      }

      await new Promise(res => setTimeout(res, RABBITMQ_RETRY_DELAY));
    }
  }
};

export const getChannel = () => {
  if (!channel) throw new Error('RabbitMQ channel is not initialized');
  return channel;
};

export const getQueueName = () => {
  return TASK_QUEUE_NAME;
};

export default connectToRabbitMQ;
