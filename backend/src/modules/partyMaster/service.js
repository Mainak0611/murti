import * as partySql from './sql.js'; // Ensure this matches your actual SQL filename

export const createParty = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- Branch Context
  
  // Destructure all specific party fields
  const { 
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
  } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  // Validation: Party Name is mandatory
  if (!party_name) return res.status(400).json({ error: 'party_name is required' });

  try {
    const created = await partySql.createParty({
      branch_id: branchId, // Link to Branch
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
    });
    return res.status(201).json({ message: 'Party created', data: created });
  } catch (err) {
    console.error('createParty error:', err);
    return res.status(500).json({ error: 'Server error creating party' });
  }
};

export const getMyParties = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; 

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Filter by the logged-in user's branch
    const rows = await partySql.findPartiesByBranchId(branchId); 
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyParties error:', err);
    return res.status(500).json({ error: 'Server error fetching parties' });
  }
};

export const getPartyById = async (req, res) => {
  const branchId = req.user.branch_id; 
  const { id } = req.params;

  try {
    const party = await partySql.findPartyById(id);
    if (!party) return res.status(404).json({ error: 'Party not found' });
    
    // Strict Security Check: Party must belong to user's branch
    if (String(party.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other branch data' });
    }

    return res.status(200).json({ data: party });
  } catch (err) {
    console.error('getPartyById error:', err);
    return res.status(500).json({ error: 'Server error fetching party' });
  }
};

export const updateParty = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  
  const { 
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
  } = req.body;

  try {
    const existing = await partySql.findPartyById(id);
    if (!existing) return res.status(404).json({ error: 'Party not found' });
    
    // Ownership Check
    if (String(existing.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await partySql.updatePartyById(id, { 
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
    });
    
    return res.status(200).json({ message: 'Party updated', data: updated });
  } catch (err) {
    console.error('updateParty error:', err);
    return res.status(500).json({ error: 'Server error updating party' });
  }
};

export const deleteParty = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const existing = await partySql.findPartyById(id);
    if (!existing) return res.status(404).json({ error: 'Party not found' });
    
    // Ownership Check
    if (String(existing.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check for related enquiries
    const enquiryCount = await partySql.findEnquiriesByPartyId(id);
    if (enquiryCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete party. There are ${enquiryCount} enquiries linked to this party. Delete those enquiries first.` 
      });
    }

    await partySql.deletePartyById(id);
    return res.status(200).json({ message: 'Party deleted' });
  } catch (err) {
    console.error('deleteParty error:', err);
    return res.status(500).json({ error: 'Server error deleting party' });
  }
};