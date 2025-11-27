//mock mongoose
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue()
    };
});

//mock isAuthenticated to bypass admin logic
jest.mock('../routes/user', () => {
    const express = require('express');
    return {
        router: express.Router(),
        isAuthenticated: () => (req, res, next) => next()
    };
});

//mock flight model
jest.mock('../models/Flight', () => {
    function Flight(data) {
        Object.assign(this, data);
    }

    Flight.prototype.save = jest.fn();

    Flight.find = jest.fn();
    Flight.findById = jest.fn();
    Flight.findOneAndUpdate = jest.fn();
    Flight.findOneAndDelete = jest.fn();

    return Flight;
});


const request = require('supertest');
const server = require('../server');
const Flight = require('../models/Flight');

describe("Flight Creation (Admin) Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks(); //resets mocks
    });

    beforeAll(() => { //for cleaner cli
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    //------ VALID TESTS ------

    // test 1: add flight
    test("POST /flights/add creates a flight", async () => {
        Flight.prototype.save.mockResolvedValue();

        const res = await request(server)
            .post("/flights/add")
            .send({
                flightNo: "AA101",
                airline: "Air Asia",
                origin: "MNL",
                destination: "CEB",
                departureDay: "Monday"
            });

        expect(Flight.prototype.save).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=added");
    });

    // test 2: delete flight
    test("POST /flights/delete/:id deletes flight", async () => {
        Flight.findOneAndDelete.mockResolvedValue({});

        const res = await request(server)
            .post("/flights/delete/123");

        expect(Flight.findOneAndDelete).toHaveBeenCalledWith({ _id: "123" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=deleted");
    });

    // test 3: edit flight
    test("POST /flights/edit/:id updates flight", async () => {
        Flight.findOneAndUpdate.mockResolvedValue({});

        const res = await request(server)
            .post("/flights/edit/777")
            .send({
                flightNo: "XY001",
                airline: "Cebu Pacific"
            });

        expect(Flight.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=updated");
    });

    //------ INVALID TESTS ------

    // test 4: delete error
    test("POST /flights/delete/:id returns redirect on error", async () => {
        Flight.findOneAndDelete.mockRejectedValue(new Error("fail"));

        const res = await request(server)
            .post("/flights/delete/bad-id");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=error");
    });

    // test 5: edit error
    test("POST /flights/edit/:id returns redirect on update failure", async () => {
        Flight.findOneAndUpdate.mockRejectedValue(new Error("nope"));

        const res = await request(server)
            .post("/flights/edit/bad-id")
            .send({ flightNo: "BROKEN" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=error");
    });
});