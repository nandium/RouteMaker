import { Handler, SNSEvent } from 'aws-lambda';

import axios from 'axios';

export const handler: Handler = async (event: SNSEvent) => {
  if (process.env['BOT_TOKEN'] === '' || process.env['BOT_CHAT_ID'] === '') {
    console.error('BOT_TOKEN or BOT_CHAT_ID not set');
    return {
      statusCode: 500,
    };
  }
  const { Records } = event;
  const {
    Sns: { Message },
  } = Records[0];

  try {
    await axios.get(`https://api.telegram.org/bot${process.env['BOT_TOKEN']}/sendMessage`, {
      params: {
        chat_id: process.env['BOT_CHAT_ID'],
        text: Message,
      },
    });
  } catch (error) {
    return {
      statusCode: 400,
      error,
    };
  }
  return {
    statusCode: 200,
  };
};
