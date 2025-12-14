// // partyService.js
// import * as partySql from './partySql.js';

// /**
//  * Controller / Service functions for handling HTTP requests.
//  * Assumes `protect` middleware has attached `req.user` with the authenticated user's DB id as `req.user.id`.
//  */

// // Create a new party enquiry (protected)
// export const createPartyEnquiry = async (req, res) => {
//   const userId = req.user && req.user.id;
//   const { party_name, contact_no, reference, remark, enquiry_date } = req.body;

//   if (!userId) return res.status(401).json({ error: 'Unauthorized' });
//   if (!party_name) return res.status(400).json({ error: 'party_name is required' });

//   try {
//     const created = await partySql.createPartyEnquiry({
//       user_id: userId,
//       party_name,
//       contact_no,
//       reference,
//       remark,
//       enquiry_date,
//     });
//     return res.status(201).json({ message: 'Party enquiry created', data: created });
//   } catch (err) {
//     console.error('createPartyEnquiry error:', err);
//     return res.status(500).json({ error: 'Server error creating party enquiry' });
//   }
// };

// // Get all party enquiries for the authenticated user (protected)
// export const getMyPartyEnquiries = async (req, res) => {
//   const userId = req.user && req.user.id;
//   if (!userId) return res.status(401).json({ error: 'Unauthorized' });

//   try {
//     const rows = await partySql.findPartyEnquiriesByUserId(userId);
//     return res.status(200).json({ data: rows });
//   } catch (err) {
//     console.error('getMyPartyEnquiries error:', err);
//     return res.status(500).json({ error: 'Server error fetching enquiries' });
//   }
// };

// // (Optional) Get a single enquiry by id — only if it belongs to the authenticated user
// export const getPartyEnquiryById = async (req, res) => {
//   const userId = req.user && req.user.id;
//   const { id } = req.params;

//   if (!userId) return res.status(401).json({ error: 'Unauthorized' });

//   try {
//     const enquiry = await partySql.findPartyEnquiryById(id);
//     if (!enquiry) return res.status(404).json({ error: 'Party enquiry not found' });
//     if (enquiry.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

//     return res.status(200).json({ data: enquiry });
//   } catch (err) {
//     console.error('getPartyEnquiryById error:', err);
//     return res.status(500).json({ error: 'Server error fetching enquiry' });
//   }
// };

// // Update an enquiry (protected) — only owner can update
// export const updatePartyEnquiry = async (req, res) => {
//   const userId = req.user && req.user.id;
//   const { id } = req.params;
//   const { party_name, contact_no, reference, remark, enquiry_date } = req.body;

//   if (!userId) return res.status(401).json({ error: 'Unauthorized' });

//   try {
//     const existing = await partySql.findPartyEnquiryById(id);
//     if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
//     if (existing.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

//     const updated = await partySql.updatePartyEnquiryById(id, { party_name, contact_no, reference, remark, enquiry_date });
//     return res.status(200).json({ message: 'Party enquiry updated', data: updated });
//   } catch (err) {
//     console.error('updatePartyEnquiry error:', err);
//     return res.status(500).json({ error: 'Server error updating enquiry' });
//   }
// };

// // Delete an enquiry (protected) — only owner can delete
// export const deletePartyEnquiry = async (req, res) => {
//   const userId = req.user && req.user.id;
//   const { id } = req.params;

//   if (!userId) return res.status(401).json({ error: 'Unauthorized' });

//   try {
//     const existing = await partySql.findPartyEnquiryById(id);
//     if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
//     if (existing.user_id !== userId) return res.status(403).json({ error: 'Forbidden' });

//     await partySql.deletePartyEnquiryById(id);
//     return res.status(200).json({ message: 'Party enquiry deleted' });
//   } catch (err) {
//     console.error('deletePartyEnquiry error:', err);
//     return res.status(500).json({ error: 'Server error deleting enquiry' });
//   }
// };

// // (Optional admin endpoint) Get all enquiries (use carefully — protect with admin guard in routes if required)
// export const getAllPartyEnquiries = async (req, res) => {
//   try {
//     const rows = await partySql.findAllPartyEnquiries();
//     return res.status(200).json({ data: rows });
//   } catch (err) {
//     console.error('getAllPartyEnquiries error:', err);
//     return res.status(500).json({ error: 'Server error fetching enquiries' });
//   }
// };


import * as partySql from './partySql.js';

export const createPartyEnquiry = async (req, res) => {
  const userId = req.user && req.user.id;
  const { party_name, contact_no, reference, remark, enquiry_date, items } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!party_name) return res.status(400).json({ error: 'party_name is required' });

  try {
    const created = await partySql.createPartyEnquiry({
      user_id: userId, party_name, contact_no, reference, remark, enquiry_date, items
    });
    return res.status(201).json({ message: 'Party enquiry created', data: created });
  } catch (err) {
    console.error('createPartyEnquiry error:', err);
    return res.status(500).json({ error: 'Server error creating party enquiry' });
  }
};

export const getMyPartyEnquiries = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await partySql.findPartyEnquiriesByUserId(userId);
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyPartyEnquiries error:', err);
    return res.status(500).json({ error: 'Server error fetching enquiries' });
  }
};

export const getPartyEnquiryById = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const enquiry = await partySql.findPartyEnquiryById(id);
    if (!enquiry) return res.status(404).json({ error: 'Party enquiry not found' });
    if (String(enquiry.user_id) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });

    return res.status(200).json({ data: enquiry });
  } catch (err) {
    console.error('getPartyEnquiryById error:', err);
    return res.status(500).json({ error: 'Server error fetching enquiry' });
  }
};

export const updatePartyEnquiry = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;
  const { party_name, contact_no, reference, remark, enquiry_date, items } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existing = await partySql.findPartyEnquiryById(id);
    if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
    if (String(existing.user_id) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });

    const updated = await partySql.updatePartyEnquiryById(id, { 
      party_name, contact_no, reference, remark, enquiry_date, items 
    });
    return res.status(200).json({ message: 'Party enquiry updated', data: updated });
  } catch (err) {
    console.error('updatePartyEnquiry error:', err);
    return res.status(500).json({ error: 'Server error updating enquiry' });
  }
};

export const deletePartyEnquiry = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existing = await partySql.findPartyEnquiryById(id);
    if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
    if (String(existing.user_id) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });

    await partySql.deletePartyEnquiryById(id);
    return res.status(200).json({ message: 'Party enquiry deleted' });
  } catch (err) {
    console.error('deletePartyEnquiry error:', err);
    return res.status(500).json({ error: 'Server error deleting enquiry' });
  }
};

// NEW: Confirm Enquiry Logic
export const confirmPartyEnquiry = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const orderId = await partySql.confirmEnquiryToOrder(id, userId);
    return res.status(200).json({ message: 'Order confirmed successfully', orderId });
  } catch (err) {
    console.error('confirmPartyEnquiry error:', err);
    if (err.message === 'ENQUIRY_NOT_FOUND') return res.status(404).json({ error: 'Enquiry not found' });
    return res.status(500).json({ error: 'Server error confirming order' });
  }
};