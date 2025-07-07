import Booking from "../models/Booking.js"
import Car from "../models/Car.js";

// Function to Check Availability of Car for a given Date
const checkAvailability = async (car, bookDate, purchaseDate) => {
    const bookings = await Booking.find({
        car,
        bookDate: { $lte: purchaseDate },
        purchaseDate: { $gte: bookDate },
    })
    return bookings.length === 0;
}

// Function to format date for display
const formatDate = (date) => {
    if (!date) return 'Not specified';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Function to get booking date range as string
const getBookingDateRange = (bookDate, purchaseDate) => {
    const startDate = formatDate(bookDate);
    const endDate = formatDate(purchaseDate);
    return `${startDate} to ${endDate}`;
}

// API to Check Availability of Cars for the given Date and location
export const checkAvailabilityOfCar = async (req, res) => {
    try {
        const { location, bookDate, purchaseDate } = req.body

        // Display the requested date range
        console.log(`Checking availability for dates: ${getBookingDateRange(bookDate, purchaseDate)}`);

        // fetch all available cars for the given location
        const cars = await Car.find({ location, isAvailable: true })

        // check car availability for the given date range using promise
        const availableCarsPromises = cars.map(async (car) => {
            const isAvailable = await checkAvailability(car._id, bookDate, purchaseDate)
            return {
                ...car._doc,
                isAvailable: isAvailable,
                requestedDates: {
                    bookDate: formatDate(bookDate),
                    purchaseDate: formatDate(purchaseDate),
                    dateRange: getBookingDateRange(bookDate, purchaseDate)
                }
            }
        })

        let availableCars = await Promise.all(availableCarsPromises);
        availableCars = availableCars.filter(car => car.isAvailable === true)

        res.json({
            success: true,
            availableCars,
            searchDates: {
                bookDate: formatDate(bookDate),
                purchaseDate: formatDate(purchaseDate),
                dateRange: getBookingDateRange(bookDate, purchaseDate)
            }
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to Create Booking
export const createBooking = async (req, res) => {
    try {
        const { _id } = req.user;
        const { car, bookDate, purchaseDate } = req.body;

        // Display booking dates
        console.log(`Creating booking for dates: ${getBookingDateRange(bookDate, purchaseDate)}`);

        const isAvailable = await checkAvailability(car, bookDate, purchaseDate)
        if (!isAvailable) {
            return res.json({ success: false, message: "Car is not available for the selected dates" })
        }

        const carData = await Car.findById(car)

        // Calculate price based on bookDate and purchaseDate
        const price = carData.Car_Price;

        const newBooking = await Booking.create({
            car,
            owner: carData.owner,
            user: _id,
            bookDate,
            purchaseDate,
            price
        })

        res.json({
            success: true,
            message: "Booking Created Successfully",
            booking: {
                ...newBooking._doc,
                bookingDates: {
                    bookDate: formatDate(bookDate),
                    purchaseDate: formatDate(purchaseDate),
                    dateRange: getBookingDateRange(bookDate, purchaseDate)
                }
            }
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to List User Bookings 
export const getUserBookings = async (req, res) => {
    try {
        const { _id } = req.user;
        const bookings = await Booking.find({ user: _id }).populate("car").sort({ createdAt: -1 })

        // Add formatted dates to each booking
        const bookingsWithDates = bookings.map(booking => ({
            ...booking._doc,
            bookingDates: {
                bookDate: formatDate(booking.bookDate),
                purchaseDate: formatDate(booking.purchaseDate),
                dateRange: getBookingDateRange(booking.bookDate, booking.purchaseDate)
            }
        }))

        res.json({ success: true, bookings: bookingsWithDates })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to get Owner Bookings
export const getOwnerBookings = async (req, res) => {
    try {
        if (req.user.role !== 'owner') {
            return res.json({ success: false, message: "Unauthorized" })
        }

        const bookings = await Booking.find({ owner: req.user._id })
            .populate('car user')
            .select("-user.password")
            .sort({ createdAt: -1 })

        // Add formatted dates to each booking
        const bookingsWithDates = bookings.map(booking => ({
            ...booking._doc,
            bookingDates: {
                bookDate: formatDate(booking.bookDate),
                purchaseDate: formatDate(booking.purchaseDate),
                dateRange: getBookingDateRange(booking.bookDate, booking.purchaseDate)
            }
        }))

        res.json({ success: true, bookings: bookingsWithDates })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

// API to get specific booking details with dates
// export const getBookingDetails = async (req, res) => {
//     try {
//         const { bookingId } = req.params;
//         const { _id } = req.user;

//         const booking = await Booking.findById(bookingId)
//             .populate('car user owner')
//             .select("-user.password");

//         if (!booking) {
//             return res.json({ success: false, message: "Booking not found" })
//         }

//         // Check if user is authorized to view this booking
//         if (booking.user._id.toString() !== _id.toString() &&
//             booking.owner._id.toString() !== _id.toString()) {
//             return res.json({ success: false, message: "Unauthorized" })
//         }

//         const bookingWithDates = {
//             ...booking._doc,
//             bookingDates: {
//                 bookDate: formatDate(booking.bookDate),
//                 purchaseDate: formatDate(booking.purchaseDate),
//                 dateRange: getBookingDateRange(booking.bookDate, booking.purchaseDate)
//             }
//         }

//         res.json({ success: true, booking: bookingWithDates })
//     } catch (error) {
//         console.log(error.message);
//         res.json({ success: false, message: error.message })
//     }
// }

// API to change booking status
export const changeBookingStatus = async (req, res) => {
    try {
        const { _id } = req.user;
        const { bookingId, status } = req.body

        const booking = await Booking.findById(bookingId)

        if (!booking) {
            return res.json({ success: false, message: "Booking not found" })
        }

        if (booking.owner.toString() !== _id.toString()) {
            return res.json({ success: false, message: "Unauthorized" })
        }

        booking.status = status;
        await booking.save();

        console.log(`Booking status updated for dates: ${getBookingDateRange(booking.bookDate, booking.purchaseDate)}`);

        res.json({
            success: true,
            message: "Status Updated",
            booking: {
                ...booking._doc,
                bookingDates: {
                    bookDate: formatDate(booking.bookDate),
                    purchaseDate: formatDate(booking.purchaseDate),
                    dateRange: getBookingDateRange(booking.bookDate, booking.purchaseDate)
                }
            }
        })
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}