// partySql.js
import pool from '../../config/db.js';

/**
 * SQL helper functions for party_enquiries table
 */

export const createPartyEnquiry = async ({ user_id, party_name, contact_no, reference, remark, enquiry_date }) => {
  const sql = `
    INSERT INTO public.party_enquiries
      (user_id, party_name, contact_no, reference, remark, enquiry_date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const params = [user_id, party_name, contact_no || null, reference || null, remark || null, enquiry_date || null];
  const { rows } = await pool.query(sql, params);
  return rows[0];
};

export const findPartyEnquiryById = async (id) => {
  const sql = `SELECT * FROM public.party_enquiries WHERE id = $1`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};

export const findPartyEnquiriesByUserId = async (user_id) => {
  const sql = `
    SELECT * FROM public.party_enquiries
    WHERE user_id = $1
    ORDER BY enquiry_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [user_id]);
  return rows;
};

export const findAllPartyEnquiries = async () => {
  const sql = `SELECT * FROM public.party_enquiries ORDER BY enquiry_date DESC, created_at DESC`;
  const { rows } = await pool.query(sql);
  return rows;
};

export const updatePartyEnquiryById = async (id, { party_name, contact_no, reference, remark, enquiry_date }) => {
  const sql = `
    UPDATE public.party_enquiries
    SET party_name = COALESCE($2, party_name),
        contact_no = COALESCE($3, contact_no),
        reference = COALESCE($4, reference),
        remark = COALESCE($5, remark),
        enquiry_date = COALESCE($6, enquiry_date)
    WHERE id = $1
    RETURNING *;
  `;
  const params = [id, party_name, contact_no, reference, remark, enquiry_date];
  const { rows } = await pool.query(sql, params);
  return rows.length ? rows[0] : null;
};

export const deletePartyEnquiryById = async (id) => {
  const sql = `DELETE FROM public.party_enquiries WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};
