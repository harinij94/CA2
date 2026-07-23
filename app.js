const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// Database Connection
const connection = mysql.createConnection({
    host: 'c237-annie-mysql.mysql.database.azure.com',
    user: 'c237_020',
    password: 'c237020@2026!',
    database: 'c237_020_ca2team2',
    ssl: {
        rejectUnauthorized: false
    }
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});



// ===============================
// Express Settings
// ===============================
app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(express.urlencoded({
    extended: false
}));


// ===============================
// Session
// ===============================
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());


// ===============================
// Authentication Middleware
// ===============================

// Check if user is logged in
const checkAuthenticated = (req, res, next) => {

    if (req.session.user) {
        return next();
    }

    res.redirect("/login");
};


// Check if logged in user is Admin
const checkAdmin = (req, res, next) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    if (req.session.user.role === "admin") {
        return next();
    }

    res.send("Access Denied. Admin only.");
};


// ===============================
// HOME PAGE
// ===============================
app.get("/", (req, res) => {
    res.render("index", {
        user: req.session.user
    });
});


// ===================================================
// TIARA
// Registration/Login/Logout
// ===================================================

// Display Login Page
app.get("/login", (req, res) => {
    res.render("login");
});

// Display Sign Up Page
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Display Forgot Password Page (optional)
app.get("/forgot", (req, res) => {
    res.render("forgot");
});

// Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT * FROM users WHERE username = ? AND password = SHA1(?)";
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        if (results.length === 0) {
            return res.send("Invalid username or password.");
        }
        req.session.user = results[0];
        res.redirect("/");
    });
});

// Register
app.post("/signup", (req, res) => {
    const {
        username,
        email,
        password,
        confirmPassword,
        contact
    } = req.body;

    if (password !== confirmPassword) {
        return res.send("Passwords do not match.");
    }
    const checkSql = "SELECT * FROM users WHERE username = ? OR email = ?";

    connection.query(checkSql, [username, email], (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        if (results.length > 0) {
            return res.send("Username or email already exists.");
        }

        const insertSql = `
            INSERT INTO users (username, email, password, contact, role)
            VALUES (?, ?, SHA1(?), ?, 'user')`; // Added in SHA1 hashing for password

        connection.query(insertSql,
            [username, email, password, contact, 'user'],
            (err) => {

                if (err) {
                    console.log(err);
                    return res.send("Database Error");
                }

                res.redirect("/login");

            });

    });

});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});


// ===================================================
// HARINI,viewing of display

app.get("/events", (req, res) => {
    const sql = "SELECT *, DATE_FORMAT(eventDate, '%Y-%m-%d') AS formattedDate FROM events ORDER BY eventDate ASC";

    connection.query(sql, (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.render("events", {
            events: results,
            user: req.session.user
        });
    });
});

// GET /events/:id - View single event details
app.get("/events/:id", (req, res) => {
    const id = req.params.id;
    const sql = "SELECT *, DATE_FORMAT(eventDate, '%W, %M %d, %Y') AS formattedDate FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (results.length === 0) {
            return res.send("Event not found.");
        }

        res.render("eventDetails", {
            event: results[0],
            user: req.session.user
        });
    });
});
// ===================================================


// ===================================================
// JANELLE
// Add Event
// ===================================================
app.get("/addEvent", (req, res) => {
    res.render("addEvent", {
        messages: req.flash()
    });
});

app.post("/addEvent", (req, res) => {
    const { eventName, eventDate, location, description } = req.body;

    if (!eventName || !eventDate || !location || !description) {
        req.flash("error", "All fields are required.");
        return res.redirect("/addEvent");
    }

    const sql = `
    INSERT INTO events
    (eventName, eventDate, location, description)
    VALUES
    (?, ?, ?, ?)`;

    connection.query(sql, [eventName, eventDate, location, description], (err) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        res.redirect("/events");
    });
});


// ===================================================
// CHLOE
// Edit Event
// ===================================================

// ===============================
// EDIT EVENT (Display Edit Form)
// ===============================
app.get("/editEvent/:id", (req, res) => {

    const id = req.params.id;

    const sql = "SELECT *, DATE_FORMAT(eventDate, '%Y-%m-%d') AS formattedDate FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (results.length === 0) {
            return res.send("Event not found.");
        }

        res.render("editEvent", {
            event: results[0]
        });

    });

});


// ===============================
// UPDATE EVENT
// ===============================
app.post("/editEvent/:id", (req, res) => {

    const id = req.params.id;

    const {
        eventName,
        eventDate,
        location,
        description
    } = req.body;

    const sql = `
UPDATE events
SET
    eventName=?,
    eventDate=?,
    location=?,
    description=?
WHERE eventId=?`;

    connection.query(
        sql,
        [
            eventName,
            eventDate,
            location,
            description,
            id
        ],
        (err) => {

            if (err) {
                console.log(err);
                return res.send("Database Error");
            }

            res.redirect("/events");
        }
    );

});

// ===================================================
// RONAN
// Delete Event
// ===================================================
app.post("/deleteEvent/:id", (req, res) => {

    const id = req.params.id;

    const sql = "DELETE FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        // Return to the Events page after deleting
        res.redirect("/events");

    });

});

// Search Event
app.get("/searchEvents", (req, res) => {

    const { keyword, dateFrom, dateTo, sortBy } = req.query;

    let sql = "SELECT *, DATE_FORMAT(eventDate, '%Y-%m-%d') AS formattedDate FROM events WHERE 1=1";
    const params = [];

    // Keyword search across name, location, description
    if (keyword && keyword.trim() !== "") {
        sql += " AND (eventName LIKE ? OR location LIKE ? OR description LIKE ?)";
        const like = "%" + keyword.trim() + "%";
        params.push(like, like, like);
    }

    // Filter by date range
    if (dateFrom) {
        sql += " AND eventDate >= ?";
        params.push(dateFrom);
    }
    if (dateTo) {
        sql += " AND eventDate <= ?";
        params.push(dateTo);
    }

    // Sorting (whitelist to prevent SQL injection — ORDER BY can't use ?)
    const sortOptions = {
        "date_asc": "eventDate ASC",
        "date_desc": "eventDate DESC",
        "name_asc": "eventName ASC",
        "name_desc": "eventName DESC"
    };
    sql += " ORDER BY " + (sortOptions[sortBy] || "eventDate ASC");

    connection.query(sql, params, (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.render("searchEvents", {
            events: results,
            filters: { keyword, dateFrom, dateTo, sortBy }
        });

    });

});

// ===================================================



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
