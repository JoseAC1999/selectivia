import bioP from '../data/predictions/biologia.json'
import hisP from '../data/predictions/historia.json'
import lenP from '../data/predictions/lengua.json'
import ingP from '../data/predictions/ingles.json'
import matP from '../data/predictions/matematicas.json'
import msoP from '../data/predictions/mates-sociales.json'
import quiP from '../data/predictions/quimica.json'
import { SUBJECT_META, addDays, generateAdaptivePlanCore } from './adaptivePlanCore.js'

const ALL_PREDICTIONS = {
  biologia: bioP.predictions,
  historia: hisP.predictions,
  lengua: lenP.predictions,
  ingles: ingP.predictions,
  matematicas: matP.predictions,
  'mates-sociales': msoP.predictions,
  quimica: quiP.predictions,
}

export { SUBJECT_META, addDays }

export function generateAdaptivePlan(input) {
  try {
    return generateAdaptivePlanCore({
      ...input,
      predictionsBySubject: ALL_PREDICTIONS,
    })
  } catch (error) {
    console.error('SelectivIA adaptive plan error:', error)
    return []
  }
}
