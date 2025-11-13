// models/Reservation.js
const mongoose = require('mongoose');

// Schema for packages
const PackageSchema = new mongoose.Schema({
  meal: { 
    type: String, 
    enum: ['Standard (included)', 'Vegetarian', 'Vegan', 'Halal', 'Kosher'],
    default: 'Standard (included)' 
  },
  mealCost : {
    type: Number,
    default: 0
  },
  seat: { 
    type: String, 
    required: true,
    trim: true
  },
  baggageWeight: {
    type: Number,
    default: 0
  },
  freeBaggageAllowance: {
    type: Number,
    default: 20
  },
  excessBaggageWeight: {
    type: Number,
    default: 0
  }
});

const ReservationSchema = new mongoose.Schema({
  bookingId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  passengerName: { 
    type: String, 
    required: true 
  },
  passengerEmail: { 
    type: String, 
    required: true 
  },
  phoneNum: {
    type: String,
    required: true
  },
  passport: String,
  tripType: {
    type: String,
    enum: ['Round-trip', 'One-way'],
    default: 'Round-trip'
  },
  travelClass: {
    type: String,
    enum: ['Economy', 'Premium Economy', 'Business', 'First Class'],
    default: 'Economy'
  },
  adults: { //passenger counts
    type: Number, 
    default: 1
  },
  children: {
    type: Number,
    default: 0
  },
  infants: {
    type: Number,
    default: 0
  },
  passengerCost: { // pricing stuff
    type: Number, 
    required: true
  },
  tripTypeCost: {
    type: Number,
    default: 0
  },
  travelClassCost: {
    type: Number,
    default: 0
  },
  mealCost: {
    type: Number,
    default: 0
  },
  baggageCost: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  flight: { 
    type: String, 
    required: true 
  },
  package: PackageSchema,
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Cancelled'], 
    default: 'Pending' },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Reservation', ReservationSchema);
