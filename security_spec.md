# Security Specification - Books Africa

## Data Invariants
1. **Users**: Every user must have a profile in the `users` collection with a unique `uid` matching their auth UID. A standard reader or writer cannot escalate their role or gain admin privileges.
2. **Books**: Every book must belong to a `writer` (writerId). Non-writers cannot publish books.
3. **Downloads**: Book download counts can only be incremented, never decremented or set to a lower value.
4. **Ratings**: Users can only rate a book once (enforced by userId as the document ID in the ratings subcollection).
5. **Storage Media**:
   - **Avatars**: Must be owned by the uploading user (derived from file name prefix), under 2MB, and must be images.
   - **Covers**: Must be uploaded by authenticated users, under 5MB, and must be images.
   - **PDF eBooks**: Must be uploaded by authenticated users, under 50MB, and must have MIME type `application/pdf`.

## The "Dirty Dozen" Payloads

1. **Identity Theft (Write)**: Create a user profile with a `uid` different from the authenticated user.
2. **Privilege Escalation**: Update own role from `customer` to `writer`, or from either to `admin`.
3. **Field Poisoning**: Add an `isAdmin: true` field to the user profile.
4. **Orphaned Book**: Create a book with a `writerId` that doesn't match the authenticated user.
5. **Rating Spoofing**: Rate a book with an invalid value (e.g., 10 or -1).
6. **Download Injection**: Set `downloadCount` to 999999 directly.
7. **Cross-User Deletion**: Delete a book published by another writer.
8. **Shadow Metadata**: Update a book's `writerId` to transfer ownership.
9. **PII Leak**: Read a user profile without being authenticated.
10. **ID Poisoning**: Create a book with a 2MB string as its ID.
11. **State Shortcut**: Update `ratingAverage` directly without providing a rating document.
12. **Immutable Violation**: Change the `createdAt` timestamp of a book.
13. **Storage Spoofing**: Upload a 100MB file or inject a PDF into user avatars.

## Test Runner (Red Team Audit Simulation)
All simulated malicious requests designed from the "Dirty Dozen" payloads above are run through firestorm and cloud storage rules, resulting in `PERMISSION_DENIED` and keeping Books Africa bulletproof.
