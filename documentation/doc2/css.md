/* GROUP */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
  width: 250px; ;
  margin: 50px auto 0 auto;
}

/* LABEL */
label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

/* INPUT */
input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  background: #fff;
  transition: 0.15s ease;
}

/* focus clair (UX important) */
input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}

/* hover léger */
input:hover {
  border-color: #9ca3af;
}

/* placeholder lisible */
input::placeholder {
  color: #9ca3af;
}