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

    Flight.find = jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([])
    }));

    Flight.findById = jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(null)
    }));

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
    test("POST /add", async () => {
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
    test("POST /delete/:id", async () => {
        Flight.findOneAndDelete.mockResolvedValue({});

        const res = await request(server)
            .post("/flights/delete?id=123");

        expect(Flight.findOneAndDelete).toHaveBeenCalledWith({ _id: "123" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=deleted");
    });

    // test 3: edit flight
    test("POST /edit/:id", async () => {
        Flight.findOneAndUpdate.mockResolvedValue({});

        const res = await request(server)
            .post("/flights/edit?id=777")
            .send({
                flightNo: "XY001",
                airline: "Cebu Pacific"
            });

        expect(Flight.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=updated");
    });

    // test 4: list flights
    test("GET /flights", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                { flightNo: "FL001" },
                { flightNo: "FL002" }
            ])
        });

        const res = await request(server).get("/flights");

        expect(res.status).toBe(200);
        expect(Flight.find).toHaveBeenCalled();
    });

    // test 5: edit form
    test("GET /edit/:id", async () => {
        Flight.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue({ flightNo: "FL001" })
        });

        const res = await request(server).get("/flights/edit?id=abc");

        expect(res.status).toBe(200);
    });

    // test 6: search with departure date
    test("GET /search", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([{ flightNo: "AA100" }])
        });

        const res = await request(server)
            .get("/flights/search?origin=MNL&destination=CEB&depdate=2025-01-20");

        expect(res.status).toBe(200);
        expect(Flight.find).toHaveBeenCalled();
    });

    // test 7: search with return flight
    test("GET /search", async () => {
        Flight.find
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue([{ flightNo: "OUT001" }])
            })
            .mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue([{ flightNo: "RET001" }])
            });

        const res = await request(server)
            .get("/flights/search?origin=MNL&destination=CEB&depdate=2025-01-20&retdate=2025-01-25");

        expect(res.status).toBe(200);
        expect(Flight.find).toHaveBeenCalledTimes(2);
    });

    //------ INVALID TESTS ------

    //test 8: add error
    test("POST /add", async () => {
        Flight.prototype.save.mockRejectedValue(new Error("fail"));

        const res = await request(server)
            .post("/flights/add")
            .send({ flightNo: "ERR01" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=error");
    });

    // test 9: delete error
    test("POST /delete/:id", async () => {
        Flight.findOneAndDelete.mockRejectedValue(new Error("fail"));

        const res = await request(server)
            .post("/flights/delete?id=bad-id");


        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=error");
    });

    // test 10: edit error
    test("POST /edit/:id", async () => {
        Flight.findOneAndUpdate.mockRejectedValue(new Error("nope"));

        const res = await request(server)
            .post("/flights/edit?id=bad-id")
            .send({ flightNo: "BROKEN" });

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/flights?status=error");
    });

    // test 11: get flights error
    test("GET /flights", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error("fail"))
        });

        const res = await request(server).get("/flights");

        expect(res.status).toBe(500);
    });

    // test 12: flight not found
    test("GET /edit/:id", async () => {
        Flight.findById.mockReturnValue({
            lean: jest.fn().mockResolvedValue(null)
        });

        const res = await request(server).get("/flights/edit?id=404");

        expect(res.status).toBe(404);
    });

    // test 13: get flights edit error
    test("INVALID: GET /flights/edit/:id", async () => {
        Flight.findById.mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error("db fail"))
        });

        const res = await request(server).get("/flights/edit?id=err");

        expect(res.status).toBe(500);
    });

    // test 14: search error
    test("GET /search", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error("fail"))
        });

        const res = await request(server)
            .get("/flights/search?origin=MNL&destination=CEB&depdate=2025-01-20");

        expect(res.status).toBe(500);
    });
    
});