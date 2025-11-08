// models/Reservation.js
const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
  meal: { type: String, default: 'Standard' },
  seat: { type: String, required: true },
  baggage: { type: String, default: 'No Extra Baggage' }
});

const ReservationSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  passengerName: { type: String, required: true },
  passengerEmail: { type: String, required: true },
  passport: String,
  flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
  package: PackageSchema,
  status: { type: String, enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reservation', ReservationSchema);
