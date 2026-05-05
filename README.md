# UniEats

UniEats is a mobile-friendly campus dining platform for KAIST members. It helps users browse cafeteria menus, check meal details and availability, apply dietary filters, and share receipt-verified feedback so cafeteria managers can improve meal quality with reliable user data.


## Project Goals

- Provide real-time access to KAIST cafeteria menus, prices, ingredients, nutrition facts, allergy warnings, and availability.
- Support personalized meal discovery through allergy, ingredient, cuisine, and dietary preference filters.
- Improve review reliability with receipt-based verification before users can submit official meal feedback.
- Give cafeteria managers tools to update menus, mark sold-out items, monitor feedback, and respond to reviews.
- Use aggregated verified feedback to surface weekly recommendations and cafeteria ranking insights.

## User Roles

### Users

KAIST students and staff who use the service to:

- Register and log in with a verified `kaist.ac.kr` email address.
- Browse daily and weekly menus by cafeteria, cuisine, and dietary category.
- Manage allergy and ingredient preference profiles.
- Upload receipts for review eligibility.
- Submit verified ratings and reviews.
- Track their own reviews and manager responses.

### Managers

Cafeteria managers who use the service to:

- Add and update menu information.
- Mark meals as available or sold out in real time.
- Review user feedback trends.
- Reply to verified reviews.
- Monitor ranking and satisfaction analytics.

## Core Features

### Authentication

- KAIST email based registration and verification.
- Secure login and session handling.
- Access control for user and manager capabilities.

### Menu Discovery

- Dashboard for daily and weekly menus.
- Cuisine and dietary categories such as Korean, Western, Halal, vegetarian, and salad.
- Meal detail pages with price, ingredients, nutritional facts, allergy warnings, and availability status.
- Campus map view for cafeteria locations and operating hours.

### Search and Filtering

- Search by meal or cafeteria.
- Filter by cuisine type, cafeteria, allergens, and dietary preferences.
- Personalized warnings for meals that conflict with a user's allergy profile.

### Verified Feedback

- Receipt upload flow for verified review eligibility.
- OCR-based receipt checking for date, cafeteria, and purchased meal.
- One receipt, one review policy.
- Meal ratings on a 1-5 scale with itemized criteria such as taste, price, and portion size.
- Manager responses shown on the user's review history.

### Analytics and Recommendations

- Weekly best meals based on verified rating averages and review volume.
- Cafeteria ranking charts based on cumulative satisfaction.
- Feedback summaries for cafeteria managers.

## Planned Application Screens

- Login
- Registration
- Dashboard
- Campus map
- Search
- Meal detail
- Meal review
- My Page
- My Reviews
- Receipt upload and verification
- Manager dashboard

## Non-Functional Targets

- Page transitions and menu updates should complete within 2 seconds under normal conditions.
- The system should support at least 500 concurrent users during peak meal hours.
- The responsive web app should support modern Chromium-based browsers and Safari.
- Mobile support should target Android 9+ and iOS 15+.
- Personal data, allergy profiles, receipt images, and dining history must be protected with encryption and HTTPS.
- The codebase should be modular so new cafeterias, categories, and integrations can be added cleanly.

## Planned Technical Direction

The final implementation stack may change as the project evolves, but the SRS currently assumes:

- Responsive web frontend
- Backend API server
- NoSQL database such as MongoDB
- OCR integration such as NAVER CLOVA OCR or Google Cloud Vision
- Cloud deployment on AWS
- Stateless API communication over HTTPS