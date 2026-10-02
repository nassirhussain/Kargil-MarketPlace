# Development Status

## Current architecture

- React and Vite frontend with an Express, MongoDB, and JWT backend.
- Listings, shops, hotels, categories, user accounts, wishlists, follows, blocks, reports, conversations, messages, ratings, and moderation use backend APIs backed by MongoDB.
- Email OTP uses Resend; phone OTP uses Twilio Verify. Provider credentials are optional but required for delivery on the selected channel.
- Browser storage retains the authentication token, a user display cache, a selected-town preference, and the post-auth navigation destination. Wishlist content is not stored in browser storage.

## Data integrity and production safeguards

- Marketplace routes return database errors instead of reading JSON listing/shop/hotel fixtures.
- Sample listing, shop, and hotel seeding has been removed. Existing fixture records already present in MongoDB require an intentional, reviewed cleanup; no production database records were deleted by this change.
- Production startup requires MongoDB, JWT and OTP hash secrets, an admin allowlist, and frontend origins. Partial third-party provider configuration is rejected.
- Production frontend builds require `VITE_API_BASE`.
- The health endpoint reports `503` unless MongoDB is connected.
- Initial category taxonomy records may be inserted into MongoDB if they are missing.

## Outstanding operational work

- Set and verify production environment variables in the hosting provider.
- Configure Resend and/or Twilio credentials and verify real OTP delivery.
- Review and remove previously seeded sample records from the production database.
- Deploy the current changes and verify the live API and frontend after deployment.
- Perform end-to-end tests with real user accounts and an admin account against a dedicated test database.

## Validation

- Run `npm run build` from the repository root with `VITE_API_BASE` set.
- Run `npm test` from `server`.
- No frontend lint or browser automation test command is configured in the repository.
