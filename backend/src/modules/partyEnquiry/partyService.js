import * as partySql from './partySql.js';

export const createPartyEnquiry = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- BRANCH ID
  const { party_name, contact_no, reference, remark, enquiry_date, items } = req.body;

  if (!party_name) return res.status(400).json({ error: 'party_name is required' });

  try {
    const created = await partySql.createPartyEnquiry({
      user_id: userId, 
      branch_id: branchId, // Pass to SQL
      party_name, contact_no, reference, remark, enquiry_date, items
    });
    return res.status(201).json({ message: 'Party enquiry created', data: created });
  } catch (err) {
    console.error('createPartyEnquiry error:', err);
    return res.status(500).json({ error: 'Server error creating party enquiry' });
  }
};

export const getMyPartyEnquiries = async (req, res) => {
  const branchId = req.user.branch_id; // <--- FILTER BY BRANCH
  
  try {
    // Note: SQL function must be updated to accept branchId instead of userId
    const rows = await partySql.findPartyEnquiriesByBranchId(branchId);
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyPartyEnquiries error:', err);
    return res.status(500).json({ error: 'Server error fetching enquiries' });
  }
};

export const getPartyEnquiryById = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const enquiry = await partySql.findPartyEnquiryById(id);
    if (!enquiry) return res.status(404).json({ error: 'Party enquiry not found' });
    
    // Check Branch Ownership
    if (String(enquiry.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

    return res.status(200).json({ data: enquiry });
  } catch (err) {
    console.error('getPartyEnquiryById error:', err);
    return res.status(500).json({ error: 'Server error fetching enquiry' });
  }
};

export const updatePartyEnquiry = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { party_name, contact_no, reference, remark, enquiry_date, items } = req.body;

  try {
    const existing = await partySql.findPartyEnquiryById(id);
    if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
    if (String(existing.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

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
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const existing = await partySql.findPartyEnquiryById(id);
    if (!existing) return res.status(404).json({ error: 'Party enquiry not found' });
    if (String(existing.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

    await partySql.deletePartyEnquiryById(id);
    return res.status(200).json({ message: 'Party enquiry deleted' });
  } catch (err) {
    console.error('deletePartyEnquiry error:', err);
    return res.status(500).json({ error: 'Server error deleting enquiry' });
  }
};

export const confirmPartyEnquiry = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- Pass Branch ID
  const { id } = req.params;

  try {
    // SQL Logic handles branch verification internally or via the query filter
    const orderId = await partySql.confirmEnquiryToOrder(id, userId, branchId);
    return res.status(200).json({ message: 'Order confirmed successfully', orderId });
  } catch (err) {
    console.error('confirmPartyEnquiry error:', err);
    if (err.message === 'ENQUIRY_NOT_FOUND') return res.status(404).json({ error: 'Enquiry not found' });
    return res.status(500).json({ error: 'Server error confirming order' });
  }
};