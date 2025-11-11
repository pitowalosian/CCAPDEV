// models/Flight.js
const mongoose = require('mongoose');

// Define the schema for a Flight
const flightSchema = new mongoose.Schema({
    flightNo: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    airline: {
        type: String,
        required: true,
        trim: true
    },
    origin: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    departureDay: {
        type: String,
        required: true,
    },
    departureTime: {
        type: String,
        required: true
    },
    arrivalDay: {
        type: String,
        required: true,
    },
    arrivalTime: {
        type: String,
        required: true
    },
    aircraftType: {
        type: String,
        required: true,
        trim: true
    },
    seatCap: {
        type: Number,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        trim: true
    }
});

// Export the model for use in other files
module.exports = mongoose.model('Flight', flightSchema);