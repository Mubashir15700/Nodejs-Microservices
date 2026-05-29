import { Channel, ConsumeMessage } from 'amqplib';
import { buildNotificationFromEvent } from '../events/notificationMapper';
import { createNotification } from '../services/notificationService';
import { getIO } from '../socket';
import logger from '../utils/logger';

const MAX_RETRIES = 3;
const PROCESSING_TIMEOUT = 5000;

// Helper: timeout wrapper
const withTimeout = (promise: Promise<any>, ms: number) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Processing timeout')), ms)
    ),
  ]);

const startConsuming = async (channel: Channel, queueName: string) => {
  try {
    // Limit concurrency
    channel.prefetch(10);

    // Main queue with DLX
    await channel.assertQueue(queueName, {
      durable: true,
      deadLetterExchange: `${queueName}.dlx`,
    });

    // Dead Letter Exchange + Queue
    await channel.assertExchange(`${queueName}.dlx`, 'direct', {
      durable: true,
    });

    await channel.assertQueue(`${queueName}.dlq`, {
      durable: true,
    });

    await channel.bindQueue(
      `${queueName}.dlq`,
      `${queueName}.dlx`,
      ''
    );

    logger.info(`Waiting for messages in queue: ${queueName}`);

    channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      let eventData: any;

      // Parse JSON safely
      try {
        eventData = JSON.parse(msg.content.toString());
        logger.info(`Received event: ${eventData?.type || 'unknown'}`);
      } catch (err) {
        logger.error(`Invalid JSON format`);
        return channel.nack(msg, false, false); // discard
      }

      // Retry count
      const retries =
        (msg.properties.headers?.['x-retries'] as number) || 0;

      let userId = '';
      let msgText = '';
      let notifType = queueName === 'taskQueue' ? 'task' : 'user';

      // Build notification safely
      try {
        if (eventData.type && eventData.data) {
          const notification = buildNotificationFromEvent(eventData);

          if (!notification) {
            logger.warn(`Unhandled event type: ${eventData.type}`);
            return channel.ack(msg);
          }

          if (!notification.userId || !notification.message) {
            logger.warn(`Invalid notification structure`);
            return channel.nack(msg, false, false);
          }

          userId = notification.userId;
          msgText = notification.message;
          notifType = notification.type;
        }
      } catch (err) {
        logger.error(`Error mapping event → notification`);
        return channel.nack(msg, false, false);
      }

      if (!userId || !msgText) {
        logger.warn(`Missing userId or message`);
        return channel.nack(msg, false, false);
      }

      try {
        // Timeout-protected processing
        await withTimeout(
          createNotification(userId, msgText, notifType),
          PROCESSING_TIMEOUT
        );

        // Emit via Socket.IO
        try {
          const io = getIO();

          io.to(userId).emit('notification:new', {
            title: 'New Notification',
            message: msgText,
            type: notifType,
            createdAt: new Date(),
          });

          logger.info(`Notification sent to user ${userId}`);
        } catch (socketErr: any) {
          logger.error(`Socket.IO error: ${socketErr.message}`);
        }

        // ACK success
        channel.ack(msg);
      } catch (err) {
        logger.error(`Processing failed: ${err}`);

        // Retry logic
        if (retries < MAX_RETRIES) {
          logger.warn(`Retrying message (${retries + 1})`);

          channel.sendToQueue(queueName, msg.content, {
            headers: {
              ...msg.properties.headers,
              'x-retries': retries + 1,
            },
            persistent: true,
            correlationId: msg.properties.correlationId,
            messageId: msg.properties.messageId,
          });

          return channel.ack(msg);
        }

        // Send to DLQ via RabbitMQ (correct way)
        logger.error(`Max retries reached → dead-lettering message`);
        return channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    logger.error(
      `Error setting up consumer for queue "${queueName}": ${err}`
    );
  }
};

export default startConsuming;
