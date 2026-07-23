CREATE UNIQUE INDEX "one_open_register_session_per_register"
  ON "cash_register_sessions" ("registerId")
  WHERE status = 'OPEN';
