const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

/**
 * Generate Sprint Report PDF
 * Returns a readable stream
 */
function generateSprintReportPDF(sprintName, issues) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      let buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Title
      doc.fontSize(28).font('Helvetica-Bold').text(`Sprint Report: ${sprintName}`, { align: 'center' });
      doc.moveDown(0.5);

      // Metadata
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.text(`Generated on ${today}`, { align: 'center' });
      doc.moveDown(1.5);

      // Summary Box
      doc.rect(40, doc.y, 515, 100).stroke();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Summary', 50, doc.y + 10);
      
      const stats = calculateStats(issues);
      doc.font('Helvetica').fontSize(10).moveDown(0.5);
      doc.text(`Total Issues: ${stats.total}`, 50);
      doc.text(`Types: ${stats.stories} Stories | ${stats.tasks} Tasks | ${stats.bugs} Bugs`, 50);
      doc.text(`Status: ${stats.completed} Completed | ${stats.inProgress} In Progress | ${stats.todo} To Do`, 50);
      doc.text(`Priority: ${stats.highestPriority} Highest | ${stats.highPriority} High`, 50);
      doc.moveDown(2);

      // Issue Type Breakdown
      doc.fontSize(14).font('Helvetica-Bold').text('Issue Type Breakdown', { underline: true });
      doc.moveDown(0.5);
      drawTypeBreakdownTable(doc, stats);

      // Status Distribution
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Status Distribution', { underline: true });
      doc.moveDown(0.5);
      drawStatusTable(doc, stats);

      // Priority Breakdown
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Priority Breakdown', { underline: true });
      doc.moveDown(0.5);
      drawPriorityTable(doc, stats);

      // High Priority Issues Detail
      if (stats.highPriorityIssues.length > 0) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('High Priority Issues', { underline: true });
        doc.moveDown(0.8);
        drawIssuesTable(doc, stats.highPriorityIssues);
      }

      // All Issues List
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('All Issues', { underline: true });
      doc.moveDown(0.8);
      drawIssuesTable(doc, issues);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Calculate statistics from issues
 */
function calculateStats(issues) {
  const stats = {
    total: issues.length,
    completed: 0,
    inProgress: 0,
    todo: 0,
    highPriority: 0,
    highestPriority: 0,
    stories: 0,
    tasks: 0,
    bugs: 0,
    typeBreakdown: {},
    statusBreakdown: {},
    priorityBreakdown: {},
    highPriorityIssues: []
  };

  issues.forEach(issue => {
    const fields = issue.fields;
    
    // Status breakdown
    const status = fields.status?.name || 'Unknown';
    if (status.toLowerCase().includes('done')) stats.completed++;
    else if (status.toLowerCase().includes('progress')) stats.inProgress++;
    else stats.todo++;
    
    stats.statusBreakdown[status] = (stats.statusBreakdown[status] || 0) + 1;

    // Type breakdown
    const type = fields.issuetype?.name || 'Unknown';
    stats.typeBreakdown[type] = (stats.typeBreakdown[type] || 0) + 1;
    
    const typeLower = type.toLowerCase();
    if (typeLower === 'story') stats.stories++;
    else if (typeLower === 'bug') stats.bugs++;
    else if (typeLower === 'task') stats.tasks++;

    // Priority breakdown
    const priority = fields.priority?.name || 'Medium';
    stats.priorityBreakdown[priority] = (stats.priorityBreakdown[priority] || 0) + 1;
    
    if (priority === 'High') stats.highPriority++;
    if (priority === 'Highest') stats.highestPriority++;

    // High priority issues
    if (priority === 'High' || priority === 'Highest') {
      stats.highPriorityIssues.push(issue);
    }
  });

  return stats;
}

/**
 * Draw issue type breakdown table
 */
function drawTypeBreakdownTable(doc, stats) {
  const rows = [['Issue Type', 'Count']];
  Object.entries(stats.typeBreakdown).forEach(([type, count]) => {
    rows.push([type, count.toString()]);
  });
  
  drawTable(doc, rows, [250, 100]);
}

/**
 * Draw status distribution table
 */
function drawStatusTable(doc, stats) {
  const rows = [['Status', 'Count']];
  Object.entries(stats.statusBreakdown).forEach(([status, count]) => {
    rows.push([status, count.toString()]);
  });
  
  drawTable(doc, rows, [250, 100]);
}

/**
 * Draw priority breakdown table
 */
function drawPriorityTable(doc, stats) {
  const rows = [['Priority', 'Count']];
  Object.entries(stats.priorityBreakdown).forEach(([priority, count]) => {
    rows.push([priority, count.toString()]);
  });
  
  drawTable(doc, rows, [250, 100]);
}

/**
 * Draw issues detail table
 */
function drawIssuesTable(doc, issues) {
  const rows = [['Key', 'Summary', 'Status', 'Priority']];
  issues.forEach(issue => {
    const summary = issue.fields.summary.substring(0, 40) + (issue.fields.summary.length > 40 ? '...' : '');
    rows.push([
      issue.key,
      summary,
      issue.fields.status?.name || 'Unknown',
      issue.fields.priority?.name || 'Medium'
    ]);
  });
  
  drawTable(doc, rows, [70, 250, 100, 100]);
}

/**
 * Generic table drawing function
 */
function drawTable(doc, rows, columnWidths) {
  const startY = doc.y;
  const cellPadding = 5;
  const rowHeight = 25;
  const x = 50;

  doc.font('Helvetica').fontSize(10);

  // Draw header
  let currentX = x;
  const headerRow = rows[0];
  headerRow.forEach((cell, i) => {
    doc.rect(currentX, startY, columnWidths[i], rowHeight).stroke();
    doc.font('Helvetica-Bold').text(cell, currentX + cellPadding, startY + cellPadding, {
      width: columnWidths[i] - cellPadding * 2,
      align: 'left'
    });
    currentX += columnWidths[i];
  });

  // Draw rows
  let currentY = startY + rowHeight;
  doc.font('Helvetica');
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let maxHeight = rowHeight;
    
    // Draw cells
    currentX = x;
    row.forEach((cell, j) => {
      doc.rect(currentX, currentY, columnWidths[j], rowHeight).stroke();
      doc.text(cell, currentX + cellPadding, currentY + cellPadding, {
        width: columnWidths[j] - cellPadding * 2,
        align: 'left'
      });
      currentX += columnWidths[j];
    });

    currentY += rowHeight;

    // Check if we need a new page
    if (currentY > doc.page.height - 50) {
      doc.addPage();
      currentY = 50;
    }
  }

  doc.y = currentY + 10;
}

/**
 * Generate Sprint Report PDF with custom options
 * Options: { includeAssignees: boolean, includeDescriptions: boolean }
 */
async function generateDetailedSprintReportPDF(sprintName, issues, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40 });
      let buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Title
      doc.fontSize(28).font('Helvetica-Bold').text(`Sprint Report: ${sprintName}`, { align: 'center' });
      doc.moveDown(0.5);

      // Metadata
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated on ${today}`, { align: 'center' });
      doc.moveDown(1.5);

      // Summary Box
      doc.rect(40, doc.y, 515, 115).stroke();
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Summary Statistics', 50, doc.y + 10);
      
      const stats = calculateStats(issues);
      const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      
      doc.font('Helvetica').fontSize(10).moveDown(0.5);
      doc.text(`Total Issues: ${stats.total}`, 50);
      doc.text(`Types: ${stats.stories} Stories | ${stats.tasks} Tasks | ${stats.bugs} Bugs`, 50);
      doc.text(`Completion Rate: ${completionRate}% (${stats.completed}/${stats.total})`, 50);
      doc.text(`Status: ${stats.completed} Done | ${stats.inProgress} In Progress | ${stats.todo} To Do`, 50);
      doc.text(`High Priority Issues: ${stats.highPriority + stats.highestPriority}`, 50);
      doc.moveDown(2);

      // Issue Type Breakdown
      doc.fontSize(14).font('Helvetica-Bold').text('Issue Type Breakdown', { underline: true });
      doc.moveDown(0.5);
      drawTypeBreakdownTable(doc, stats);

      // Status Distribution
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Status Distribution', { underline: true });
      doc.moveDown(0.5);
      drawStatusTable(doc, stats);

      // Priority Breakdown
      doc.moveDown(1.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Priority Breakdown', { underline: true });
      doc.moveDown(0.5);
      drawPriorityTable(doc, stats);

      // High Priority Issues Detail
      if (stats.highPriorityIssues.length > 0) {
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('High & Highest Priority Issues', { underline: true });
        doc.moveDown(0.8);
        drawIssuesTable(doc, stats.highPriorityIssues);
      }

      // All Issues List
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('All Issues', { underline: true });
      doc.moveDown(0.8);
      drawIssuesTable(doc, issues);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateSprintReportPDF,
  generateDetailedSprintReportPDF
};
