-- Runs only when the Postgres volume is initialized for the first time.
-- Existing volumes need the database created by hand; see README.
CREATE DATABASE marketplace_test OWNER marketplace;
