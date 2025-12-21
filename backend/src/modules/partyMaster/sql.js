import pool from '../../config/db.js';

export const createParty = async ({ 
  branch_id, 
  firm_name, 
  party_name, 
  contact_no, 
  contact_no_2, 
  email, 
  gst_number, 
  pan_number, 
  reference_person, 
  reference_contact_no, 
  billing_address 
}) => {
  const sql = `
    INSERT INTO public.party_master
      (branch_id, firm_name, party_name, contact_no, contact_no_2, email, gst_number, pan_number, reference_person, reference_contact_no, billing_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
  
  const params = [
    branch_id, 
    firm_name || null, 
    party_name, 
    contact_no || null, 
    contact_no_2 || null, 
    email || null, 
    gst_number || null,
    pan_number || null,
    reference_person || null,
    reference_contact_no || null,
    billing_address || null
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
};

export const findPartyById = async (id) => {
  const sql = `SELECT * FROM public.party_master WHERE id = $1`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};

// --- THIS WAS MISSING ---
export const findPartiesByBranchId = async (branchId) => {
  const sql = `
    SELECT * FROM public.party_master
    WHERE branch_id = $1
    ORDER BY id DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};
// ------------------------

export const updatePartyById = async (id, { 
  firm_name, 
  party_name, 
  contact_no, 
  contact_no_2, 
  email, 
  gst_number, 
  pan_number, 
  reference_person, 
  reference_contact_no, 
  billing_address 
}) => {
  const sql = `
    UPDATE public.party_master
    SET firm_name = COALESCE($2, firm_name),
        party_name = COALESCE($3, party_name),
        contact_no = COALESCE($4, contact_no),
        contact_no_2 = COALESCE($5, contact_no_2),
        email = COALESCE($6, email),
        gst_number = COALESCE($7, gst_number),
        pan_number = COALESCE($8, pan_number),
        reference_person = COALESCE($9, reference_person),
        reference_contact_no = COALESCE($10, reference_contact_no),
        billing_address = COALESCE($11, billing_address)
    WHERE id = $1
    RETURNING *;
  `;
  
  const params = [
    id, 
    firm_name, 
    party_name, 
    contact_no, 
    contact_no_2, 
    email, 
    gst_number, 
    pan_number,
    reference_person,
    reference_contact_no,
    billing_address
  ];
  
  const { rows } = await pool.query(sql, params);
  return rows.length ? rows[0] : null;
};

export const findEnquiriesByPartyId = async (partyId) => {
  const sql = `SELECT COUNT(*) as count FROM public.party_enquiries WHERE party_id = $1`;
  const { rows } = await pool.query(sql, [partyId]);
  return rows[0].count;
};

export const deletePartyById = async (id) => {
  const sql = `DELETE FROM public.party_master WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};