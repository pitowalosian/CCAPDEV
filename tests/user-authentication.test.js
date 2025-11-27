//mock mongoose
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue(),
    };
});

//mock user model
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

const request = require('supertest');
const server = require('../server');        
const User = require("../models/User");


function mockUser(data, matchPassword) {
    return {
        ...data,
        comparePassword: jest.fn().mockResolvedValue(matchPassword)
    };
}

describe("User Authentication Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks(); //resets mocks
    });

    beforeAll(() => { //for cleaner cli
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    

    //------ VALID TESTS ------

    // test 1: register
    test("POST /register", async () => {

        User.create.mockResolvedValue({
            firstname: "Juan",
            lastname: "Dela Cruz",
            email: "juan@example.com"
        });

        const res = await request(server)
            .post("/profile/register")   
            .send({
                firstname: "Juan",
                lastname: "Dela Cruz",
                email: "juan@example.com",
                password: "12345"
            });

        expect(User.create).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/login?registered=true");
    });

    // test 2: successful login (normal user)
    test("POST /login", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ _id: "user123", email: "user@test.com", isAdmin: false }, true)
        );

        const res = await request(server)
            .post("/profile/login")        
            .send({
                email: "user@test.com",
                password: "password123"
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "user@test.com" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/User");
    });

    // test 3: successful login (admin)
    test("POST /login admin", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ _id: "admin123", email: "admin@test.com", isAdmin: true }, true)
        );

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "admin@test.com",
                password: "adminpass"
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "admin@test.com" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/Admin");
    });

    // test 4: log out
    test("GET /logout", async () => {

        const res = await request(server).get("/profile/logout");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/login");
    });

    //------ INVALID TESTS ------

    // test 5: user is not found
    test("POST /profile/login returns 401 when user does not exist", async () => {

        User.findOne.mockResolvedValue(null); // simulates no user found

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "notfound@test.com",
                password: "invalid"
            });

        expect(res.status).toBe(401);
        expect(res.text).toMatch(/Invalid login/i);
    });

    // test 6: failed login
    test("POST /profile/login rejects incorrect password", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ email: "wrong@test.com", isAdmin: false }, false)
        );

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "wrong@test.com",
                password: "bad"
            });

        expect(res.status).toBe(401);
        expect(res.text).toMatch(/Invalid login/i);
    });

    // test 7: server error
    test("POST /profile/login returns 500 when DB error happens", async () => {

        User.findOne.mockRejectedValue(new Error("DB error"));

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "broken@test.com",
                password: "pass"
            });

        expect(res.status).toBe(500);
        expect(res.text).toMatch(/Server error/i);
    });

});
