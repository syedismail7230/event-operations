import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET;

let razorpay: any = null;

if (!RAZORPAY_KEY_ID || !RAZORPAY_SECRET || RAZORPAY_KEY_ID === "mock_key_id") {
  console.warn("WARNING: Razorpay credentials missing. Payment endpoint is on HOLD and will fail if called.");
} else {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID as string,
    key_secret: RAZORPAY_SECRET as string,
  });
}

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, amount } = req.body;

    if (!razorpay) {
      res.status(503).json({ error: 'Payment gateway is currently on hold.' });
      return;
    }

    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_event_${eventId}`
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Razorpay Error', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay) {
      res.status(503).json({ error: 'Payment gateway is currently on hold.' });
      return;
    }

    const hmac = crypto.createHmac('sha256', RAZORPAY_SECRET as string);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment is successful, issue ticket in DB
      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};
