import dicomParser from 'dicom-parser';
import { standardDataElements } from 'dicom-data-dictionary';

// Type assertion for the Web Worker context
const ctx: Worker = self as any;

ctx.addEventListener('message', (e: MessageEvent) => {
  const { buffer, fileId, fileName } = e.data;

  // Immediate guard against null/truncated buffer or obvious metadata files
  if (!buffer || buffer.byteLength < 132 || (fileName && (
      fileName.includes('Zone.Identifier') ||
      fileName.startsWith('.') ||
      fileName.startsWith('._') ||
      fileName === 'Thumbs.db' ||
      fileName === 'desktop.ini'
  ))) {
    ctx.postMessage({
      success: true,
      isImage: false,
      fileId,
      fileName,
      buffer
    }, [buffer]);
    return;
  }

  try {
    // dicomParser expects a Uint8Array
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);
    
    // Check if the DICOM object has pixel data
    if (!dataSet.elements || (!dataSet.elements['x7fe00010'] && !dataSet.elements['x7fe00008'] && !dataSet.elements['x7fe00009'])) {
       ctx.postMessage({
         success: true,
         isImage: false,
         fileId,
         fileName,
         buffer
       }, [buffer]);
       return;
    }

    // Extract relevant DICOM tags using dicom-parser
    const parseFloatArray = (str: string | undefined) => {
        if (!str) return null;
        const arr = str.split('\\').map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
        return arr.length > 0 ? arr : null;
    };

    const parseNullableFloat = (str: string | undefined) => {
        if (!str) return null;
        const v = parseFloat(str.trim());
        return isNaN(v) ? null : v;
    };

    const rawTags: Array<{ tag: string, name: string, value: string }> = [];
    if (dataSet.elements) {
      for (const tag in dataSet.elements) {
        // Skip Pixel Data and other large binary fields if necessary
        if (tag === 'x7fe00010') continue;
        
        let value = '';
        try {
           // Basic string extraction, might not be perfect for every VR but sufficient for a raw dump
           value = dataSet.string(tag) || '';
        } catch (e) {
           value = '<binary or unparseable>';
        }

        if (value && value.trim().length > 0) {
           const hexTag = tag.substring(1).toUpperCase(); // e.g., '00100010'
           
           // Format tag from '00100010' to '(0010,0010)'
           const formattedTag = hexTag.length === 8 
             ? `(${hexTag.substring(0, 4)},${hexTag.substring(4, 8)})` 
             : `(${hexTag})`;
             
           // Lookup human readable name
           const dictEntry = (standardDataElements as Record<string, any>)[hexTag];
           const humanName = dictEntry ? dictEntry.name : 'Unknown Tag';
             
           rawTags.push({ tag: formattedTag, name: humanName, value });
        }
      }
    }

    const metadata = {
      patientName: dataSet.string('x00100010') || 'Unknown Patient',
      patientId: dataSet.string('x00100020') || 'Unknown ID',
      patientBirthDate: dataSet.string('x00100030'),
      patientSex: dataSet.string('x00100040'),
      patientAge: dataSet.string('x00101010'),
      studyDate: dataSet.string('x00080020') || 'Unknown Date',
      studyTime: dataSet.string('x00080030'),
      studyDescription: dataSet.string('x00081030') || dataSet.string('x0008103e'),
      accessionNumber: dataSet.string('x00080050'),
      referringPhysician: dataSet.string('x00080090'),
      seriesDescription: dataSet.string('x0008103e') || 'Unknown Series',
      modality: dataSet.string('x00080060') || 'Unknown Modality',
      studyInstanceUID: dataSet.string('x0020000d') || 'UnknownStudyUID',
      seriesInstanceUID: dataSet.string('x0020000e') || 'UnknownSeriesUID',
      instanceNumber: parseInt(dataSet.string('x00200013') || '0', 10),
      imagePositionPatient: parseFloatArray(dataSet.string('x00200032')),
      imageOrientationPatient: parseFloatArray(dataSet.string('x00200037')),
      pixelSpacing: parseFloatArray(dataSet.string('x00280030')),
      sliceLocation: parseNullableFloat(dataSet.string('x00201041')),
      rows: dataSet.uint16('x00280010'),
      columns: dataSet.uint16('x00280011'),
      
      institutionName: dataSet.string('x00080080') || 'Unknown',
      acquisitionDate: dataSet.string('x00080022'),
      acquisitionTime: dataSet.string('x00080032'),
      manufacturer: dataSet.string('x00080070'),
      model: dataSet.string('x00081090'),
      fieldStrength: dataSet.string('x00180087'),
      sliceThickness: dataSet.string('x00180050'),
      spacingBetweenSlices: dataSet.string('x00180088'),
      scanningSequence: dataSet.string('x00180020'),
      tr: dataSet.string('x00180080'),
      te: dataSet.string('x00180081'),
      ti: dataSet.string('x00180082'),
      flipAngle: dataSet.string('x00181314'),
      echoTrainLength: dataSet.string('x00180091'),
      echoNumbers: dataSet.string('x00180086'),
      rawTags,
    };

    // Transfer the ArrayBuffer BACK to the main thread (zero-copy)
    ctx.postMessage({ 
      success: true, 
      isImage: true,
      fileId, 
      fileName, 
      metadata, 
      buffer 
    }, [buffer]);

  } catch (error) {
    const errorStr = String(error);
    const isNonDicom = errorStr.includes('DICM prefix not found') || 
                       errorStr.includes('read past end of buffer') || 
                       errorStr.includes('invalid DICOM');

    // If parsing fails, still transfer the buffer back so it isn't lost
    ctx.postMessage({ 
      success: false, 
      isImage: false,
      isNonDicom,
      fileId, 
      fileName, 
      error: errorStr, 
      buffer 
    }, [buffer]);
  }
});
