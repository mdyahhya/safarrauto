const webpush = require('web-push');

// Configure VAPID keys
// The user provided the keys. They will add them to Netlify environment variables:
// VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
try {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:safarrrides@gmail.com',
    process.env.VAPID_PUBLIC_KEY || 'BPk13h06zakSh4-5vSFnt__Wsf4k0gGB6-_qtyw0ceKG4YATLxRz_M7_rBBuwDkfbWQUoJjQFlFNXsiQyFGytDY',
    process.env.VAPID_PRIVATE_KEY || '4bDrLrXT5A_B0vnxuQAmDa4ZlLnddgmp4V4zjo6XoXY'
  );
} catch (e) {
  console.warn('Web push setup error:', e);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { subscriptions, payload } = JSON.parse(event.body);

    if (!subscriptions || !Array.isArray(subscriptions)) {
      return { statusCode: 400, body: 'Invalid subscriptions array' };
    }

    const notificationPayload = JSON.stringify(payload);

    // Send notifications to all provided subscriptions
    const promises = subscriptions.map((sub) =>
      webpush.sendNotification(sub, notificationPayload).catch((err) => {
        console.error('Error sending push to a driver', err);
        return { success: false, err };
      })
    );

    await Promise.all(promises);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Notifications sent successfully' })
    };
  } catch (error) {
    console.error('Error in notify-drivers function', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
