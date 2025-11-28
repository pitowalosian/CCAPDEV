//mock mongoose
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue()
    };
});

// mock flight model
jest.mock('../models/Flight', () => ({
    find: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([])
    })),
}));

//mock user model
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

//mock isAuthenticated to bypass admin logic
jest.mock('../routes/user', () => {
    const express = require('express');
    return {
        router: express.Router(),
        isAuthenticated: () => (req, res, next) => {
            if (!req.session) 
                req.session = {};
            
            req.session.userId = "507f1f77bcf86cd799439011"; 
            req.session.user = { email: "test@test.com" };     

            next();
        }
    };
});


//mock reservations model
jest.mock('../models/Reservation', () => {
    // mock constructor
    const Reservation = jest.fn().mockImplementation(function (data) {
        Object.assign(this, data);
        this.save = jest.fn();  // instance-specific save()
    });

    // static methods
    Reservation.find = jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([])
    }));

    Reservation.findOne = jest.fn();
    Reservation.findById = jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(null)
    }));

    Reservation.findByIdAndUpdate = jest.fn();

    return Reservation;
});

const request = require('supertest');
const server = require('../server');
const Flight = require('../models/Flight');
const Reservation = require('../models/Reservation');

describe("Reservation Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks(); //resets mocks
    });

    beforeAll(() => { //for cleaner cli
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    //------ VALID TESTS ------

    // test 1: booking form with flight data
    test("GET /book", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ flightNo: "FL001" }])
        });

        const res = await request(server)
            .get("/reservations/book?depart=FL001");

        expect(res.status).toBe(200);
        expect(Flight.find).toHaveBeenCalled();
    });

    // test 2: successful reservation creation
    test("POST /book", async () => {

        const res = await request(server)
            .post("/reservations/book")
            .send({
                passengerName: "Juan Cruz",
                passengerEmail: "juan@test.com",
                phoneNum: "09178620245",
                passport: "P1234567", 
                flightNo: "FL001",
                seat: "A1",
                meal: "0",
                baggage: "10",

                adults: "1",
                children: "0",
                infants: "0",

                passengerCost: "1000",
                passengerCostRaw: "1000",

                tripType: "One-way",
                tripTypeCostRaw: "0",

                travelClass: "Economy",
                travelClassCostRaw: "0",

                mealCostRaw: "0",
                baggageCostRaw: "0",

                totalPriceRaw: "1000",
                totalPrice: "1000",            

                package: {
                    seat: "A1",
                    meal: "Standard (included)"
                }
            });

        const instance = Reservation.mock.instances[0];

        expect(instance.save).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/book?status=added");
    });

    // test 3: reservation list
    test("GET /list", async () => {

        Reservation.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ passengerName: "Tester", flight: "FL001" }])
        });

        Flight.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ flightNo: "FL001" }])
        });

        const res = await request(server).get("/reservations/list");

        expect(res.status).toBe(200);
        expect(Reservation.find).toHaveBeenCalled();

    });

    // test 4: edit form
    test("GET /edit/:id", async () => {

        Reservation.findById = jest.fn(() => ({
            lean: jest.fn().mockResolvedValue({
                _id: "123",
                flight: "FL001",
                package: { seat: "A1" }
            })
        }));

        Reservation.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
        });

        const res = await request(server).get("/reservations/edit/123");

        expect(res.status).toBe(200);
    });

    // test 5: update reservation
    test("POST /edit/:id", async () => {

        Reservation.findByIdAndUpdate = jest.fn().mockResolvedValue({});

        const res = await request(server)
            .post("/reservations/edit/123")
            .send({
                seat: "A2",
                meal: "Vegetarian",
                baggage: 15,
                status: "Confirmed"
            });

        expect(Reservation.findByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/list?status=updated");
    });

    // test 6: cancel reservation
    test("POST /delete/:id", async () => {

        Reservation.findByIdAndUpdate = jest.fn().mockResolvedValue({});

        const res = await request(server)
            .post("/reservations/delete/123");

        expect(Reservation.findByIdAndUpdate)
            .toHaveBeenCalledWith("123", { status: "Cancelled" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/list?status=cancelled");
    });

    // test 7: check-in success
    test("POST /api/checkin", async () => {

        Reservation.findOne.mockResolvedValue({
            bookingId: "BKG-123",
            passengerName: "John Doe",
            package: { seat: "A1" },
            save: jest.fn().mockResolvedValue(true)
        });

        const res = await request(server)
            .post("/reservations/api/checkin")
            .send({
                bookingId: "BKG-123",
                lastName: "Doe"
            });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Check-in successful/i);
    });

    //------ INVALID TESTS ------

    // test 8: booking form error
    test("GET /book", async () => {

        Flight.find.mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error("fail"))
        });

        const res = await request(server)
            .get("/reservations/book?depart=FL001");

        expect(res.status).toBe(500);
    });

    // test 9: reservation creation fails
    test("POST /book", async () => {

        // manually inject a broken instance
        Reservation.mockImplementationOnce(function () {
            this.save = jest.fn().mockRejectedValue(new Error("fail"));
        });

        const res = await request(server)
            .post("/reservations/book")
            .send({ passengerName: "Test" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/book?status=error");
    });

    // test 10: edit form not found
    test("GET /edit/:id", async () => {

        Reservation.findById = jest.fn(() => ({
            lean: jest.fn().mockResolvedValue(null)
        }));

        const res = await request(server).get("/reservations/edit/999");

        expect(res.status).toBe(404);
    });

    // test 11: update reservation fails
    test("POST /edit/:id", async () => {

        Reservation.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error("fail"));

        const res = await request(server)
            .post("/reservations/edit/123")
            .send({ seat: "A9" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/list?status=error");
    });

    // test 12: cancel reservation fails
    test("POST /delete/:id", async () => {

        Reservation.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error("fail"));

        const res = await request(server)
            .post("/reservations/delete/555");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/reservations/list?status=error");
    });
});